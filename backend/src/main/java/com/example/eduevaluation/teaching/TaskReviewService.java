package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.common.AiWorkerClient;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
class TaskReviewService {
    private static final Pattern EXTENSION_PATTERN = Pattern.compile("(?i)(?:\\.|\\b)(pdf|docx|txt|md|pptx?|xlsx?|zip|jpg|jpeg|png|mp3|mp4)\\b");
    private static final Pattern SIZE_PATTERN = Pattern.compile("(?i)(\\d+(?:\\.\\d+)?)\\s*(KB|MB|GB|K|M|G)\\b");

    private final CourseRepository courses;
    private final CourseStaffRepository courseStaff;
    private final CourseTaskRepository tasks;
    private final TaskSubmissionRepository submissions;
    private final TaskSubmissionRuleRepository rules;
    private final TaskSubmissionReviewRepository reviews;
    private final ModulePermissionService permissions;
    private final AiWorkerClient aiWorkerClient;
    private final Path submissionDirectory;

    TaskReviewService(
            CourseRepository courses,
            CourseStaffRepository courseStaff,
            CourseTaskRepository tasks,
            TaskSubmissionRepository submissions,
            TaskSubmissionRuleRepository rules,
            TaskSubmissionReviewRepository reviews,
            ModulePermissionService permissions,
            AiWorkerClient aiWorkerClient,
            @Value("${app.upload-dir:data/uploads}") String uploadDirectory
    ) {
        this.courses = courses;
        this.courseStaff = courseStaff;
        this.tasks = tasks;
        this.submissions = submissions;
        this.rules = rules;
        this.reviews = reviews;
        this.permissions = permissions;
        this.aiWorkerClient = aiWorkerClient;
        this.submissionDirectory = Path.of(uploadDirectory, "task-submissions").toAbsolutePath().normalize();
    }

    TaskDetailResponse detail(String taskId, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireView(task, principal);
        return new TaskDetailResponse(task.getId(), task.getCourseId(), task.getTitle(), task.getDescription(), task.getDeadline(),
                task.getStatus(), ruleResponse(taskId), submissions.findByTaskIdOrderBySubmittedAtDesc(taskId).size());
    }

    TaskRuleResponse updateRule(String taskId, RuleRequest request, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireEdit(task, principal);
        long maxSize = request.maxFileSizeBytes() == null
                ? TaskSubmissionRuleEntity.DEFAULT_MAX_FILE_SIZE_BYTES : request.maxFileSizeBytes();
        if (maxSize <= 0 || maxSize > 100L * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单文件大小必须在 1 字节到 100 MB 之间");
        }
        String extensions = normalizeExtensions(request.allowedExtensions());
        TaskSubmissionRuleEntity rule = rules.findById(taskId).orElseGet(() -> new TaskSubmissionRuleEntity(taskId));
        rule.update(extensions, maxSize, trimToNull(request.ruleText()), trimToNull(request.importedFileName()));
        return ruleResponse(rules.save(rule));
    }

    RuleImportResponse importRule(String taskId, MultipartFile file, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireEdit(task, principal);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择规则文档");
        }
        String fileName = safeFileName(file.getOriginalFilename());
        String extension = extension(fileName);
        if (!List.of(".pdf", ".docx", ".txt", ".md").contains(extension)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "规则文档仅支持 PDF、DOCX、TXT 或 Markdown");
        }
        Map<String, Object> parsed = aiWorkerClient.validateDocument(file);
        String text = String.valueOf(parsed.getOrDefault("text", parsed.getOrDefault("content", ""))).trim();
        if (text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "规则文档未解析出可用文本");
        }
        List<String> extensions = suggestedExtensions(text);
        Long size = suggestedSize(text);
        return new RuleImportResponse(fileName, text, extensions, size);
    }

    List<SubmissionResponse> submissions(String taskId, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireView(task, principal);
        return submissions.findByTaskIdOrderBySubmittedAtDesc(taskId).stream().map(this::submissionResponse).toList();
    }

    List<BatchReviewResult> createDrafts(String taskId, List<String> submissionIds, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireEdit(task, principal);
        if (submissionIds == null || submissionIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择至少一份提交作品");
        }
        return submissionIds.stream().distinct().map(id -> createDraft(task, id, principal)).toList();
    }

    @Transactional
    ReviewResponse updateReview(String taskId, String submissionId, ReviewRequest request, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireEdit(task, principal);
        requireSubmission(taskId, submissionId);
        TaskSubmissionReviewEntity review = reviews.findBySubmissionId(submissionId)
                .orElseGet(() -> new TaskSubmissionReviewEntity(UUID.randomUUID().toString(), submissionId, null, principal.userId()));
        TaskReviewStatus status = request.publish() ? TaskReviewStatus.PUBLISHED : TaskReviewStatus.DRAFT;
        review.update(request.score(), trimToNull(request.feedback()), status, principal.userId());
        return reviewResponse(reviews.save(review));
    }

    private BatchReviewResult createDraft(CourseTaskEntity task, String submissionId, AppPrincipal principal) {
        try {
            TaskSubmissionEntity submission = requireSubmission(task.getId(), submissionId);
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("filePath", submissionDirectory.resolve(submission.getObjectKey()).normalize().toString().replace("\\", "/"));
            request.put("fileName", submission.getFileName());
            request.put("criteriaText", ruleResponse(task.getId()).ruleText());
            request.put("assignmentId", task.getId());
            Map<String, Object> aiResponse = aiWorkerClient.analyzeWorkAsync(request);
            String aiTaskId = String.valueOf(aiResponse.get("task_id"));
            TaskSubmissionReviewEntity review = reviews.findBySubmissionId(submissionId)
                    .orElseGet(() -> new TaskSubmissionReviewEntity(UUID.randomUUID().toString(), submissionId, aiTaskId, principal.userId()));
            reviews.save(review);
            return new BatchReviewResult(submissionId, true, "已创建智能批阅草稿", reviewResponse(review));
        } catch (ResponseStatusException exception) {
            return new BatchReviewResult(submissionId, false, exception.getReason(), null);
        } catch (RuntimeException exception) {
            return new BatchReviewResult(submissionId, false, "智能批阅暂时不可用，请稍后重试", null);
        }
    }

    private TaskSubmissionEntity requireSubmission(String taskId, String submissionId) {
        TaskSubmissionEntity submission = submissions.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "提交作品不存在"));
        if (!taskId.equals(submission.getTaskId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "提交作品不属于当前作业");
        }
        return submission;
    }

    private SubmissionResponse submissionResponse(TaskSubmissionEntity submission) {
        ReviewResponse review = reviews.findBySubmissionId(submission.getId()).map(this::reviewResponse).orElse(null);
        return new SubmissionResponse(submission.getId(), submission.getStudentId(), submission.getFileName(), submission.getContentType(),
                submission.getFileSizeBytes(), submission.getSubmittedAt(), review);
    }

    private ReviewResponse reviewResponse(TaskSubmissionReviewEntity review) {
        return new ReviewResponse(review.getScore(), review.getFeedback(), review.getStatus(), review.getAiTaskId(),
                review.getReviewerId(), review.getReviewedAt());
    }

    private TaskRuleResponse ruleResponse(String taskId) {
        return rules.findById(taskId).map(this::ruleResponse)
                .orElse(new TaskRuleResponse(List.of(), TaskSubmissionRuleEntity.DEFAULT_MAX_FILE_SIZE_BYTES, null, null, null));
    }

    private TaskRuleResponse ruleResponse(TaskSubmissionRuleEntity rule) {
        List<String> extensions = rule.getAllowedExtensions().isBlank() ? List.of() : List.of(rule.getAllowedExtensions().split(","));
        return new TaskRuleResponse(extensions, rule.getMaxFileSizeBytes(), rule.getRuleText(), rule.getImportedFileName(), rule.getImportedAt());
    }

    private String normalizeExtensions(List<String> values) {
        if (values == null) {
            return "";
        }
        return values.stream().filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .map(value -> value.startsWith(".") ? value : "." + value)
                .distinct().collect(java.util.stream.Collectors.joining(","));
    }

    private List<String> suggestedExtensions(String text) {
        List<String> result = new ArrayList<>();
        Matcher matcher = EXTENSION_PATTERN.matcher(text);
        while (matcher.find()) {
            String value = "." + matcher.group(1).toLowerCase(Locale.ROOT);
            if (!result.contains(value)) result.add(value);
        }
        return result;
    }

    private Long suggestedSize(String text) {
        Matcher matcher = SIZE_PATTERN.matcher(text);
        if (!matcher.find()) return null;
        double value = Double.parseDouble(matcher.group(1));
        return switch (matcher.group(2).toUpperCase(Locale.ROOT)) {
            case "KB", "K" -> (long) (value * 1024);
            case "MB", "M" -> (long) (value * 1024 * 1024);
            default -> (long) (value * 1024 * 1024 * 1024);
        };
    }

    private String safeFileName(String name) {
        return Path.of(name == null ? "rule-document" : name).getFileName().toString();
    }

    private String extension(String fileName) {
        int index = fileName.lastIndexOf('.');
        return index < 0 ? "" : fileName.substring(index).toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private CourseTaskEntity requireTask(String taskId) {
        return tasks.findById(taskId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在"));
    }

    private void requireView(CourseTaskEntity task, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        requireStaff(task.getCourseId(), principal);
    }

    private void requireEdit(CourseTaskEntity task, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.EDIT);
        requireStaff(task.getCourseId(), principal);
    }

    private void requireStaff(String courseId, AppPrincipal principal) {
        if (!courses.existsById(courseId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程不存在");
        }
        if (principal.role() != UserRole.ADMIN && !courseStaff.existsByCourseIdAndTeacherId(courseId, principal.userId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您不在该课程教学团队中");
        }
    }

    record TaskDetailResponse(String id, String courseId, String title, String description, LocalDateTime deadline,
                              TaskStatus status, TaskRuleResponse rule, int submissionCount) {}
    record TaskRuleResponse(List<String> allowedExtensions, long maxFileSizeBytes, String ruleText,
                            String importedFileName, LocalDateTime importedAt) {}
    record RuleRequest(List<String> allowedExtensions, Long maxFileSizeBytes, String ruleText, String importedFileName) {}
    record RuleImportResponse(String fileName, String ruleText, List<String> allowedExtensions, Long maxFileSizeBytes) {}
    record SubmissionResponse(String id, String studentId, String fileName, String contentType, Long fileSizeBytes,
                              LocalDateTime submittedAt, ReviewResponse review) {}
    record ReviewRequest(BigDecimal score, String feedback, boolean publish) {}
    record ReviewResponse(BigDecimal score, String feedback, TaskReviewStatus status, String aiTaskId,
                          String reviewerId, LocalDateTime reviewedAt) {}
    record BatchReviewResult(String submissionId, boolean success, String message, ReviewResponse review) {}
}
