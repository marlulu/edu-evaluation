package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.common.AiWorkerClient;
import com.example.eduevaluation.common.StorageService;
import com.example.eduevaluation.notification.NotificationService;
import com.example.eduevaluation.work.AnalysisReviewService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CourseTaskService {
    private final CourseRepository courses;
    private final CourseStaffRepository courseStaff;
    private final CourseMemberRepository courseMembers;
    private final CourseTaskRepository tasks;
    private final TaskSubmissionRepository submissions;
    private final TaskSubmissionRuleRepository rules;
    private final CourseAttachmentRepository courseAttachments;
    private final SubmissionCommentRepository comments;
    private final ModulePermissionService permissions;
    private final AiWorkerClient aiWorkerClient;
    private final StorageService storageService;
    private final NotificationService notificationService;
    private final AnalysisReviewService analysisReviewService;
    private final Path uploadDirectory;
    private final Path courseAttachmentDirectory;

    public CourseTaskService(
            CourseRepository courses,
            CourseStaffRepository courseStaff,
            CourseMemberRepository courseMembers,
            CourseTaskRepository tasks,
            TaskSubmissionRepository submissions,
            TaskSubmissionRuleRepository rules,
            CourseAttachmentRepository courseAttachments,
            SubmissionCommentRepository comments,
            ModulePermissionService permissions,
            AiWorkerClient aiWorkerClient,
            StorageService storageService,
            NotificationService notificationService,
            AnalysisReviewService analysisReviewService,
            @Value("${app.upload-dir:data/uploads}") String uploadDirectory
    ) {
        this.courses = courses; this.courseStaff = courseStaff; this.courseMembers = courseMembers;
        this.tasks = tasks; this.submissions = submissions; this.rules = rules;
        this.courseAttachments = courseAttachments;
        this.comments = comments;
        this.permissions = permissions;
        this.aiWorkerClient = aiWorkerClient;
        this.storageService = storageService;
        this.notificationService = notificationService;
        this.analysisReviewService = analysisReviewService;
        this.uploadDirectory = Path.of(uploadDirectory, "task-submissions").toAbsolutePath().normalize();
        this.courseAttachmentDirectory = Path.of(uploadDirectory, "course-attachments").toAbsolutePath().normalize();
    }

    public List<TaskResponse> listForCourse(String courseId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        requireStaff(courseId, principal);
        return tasks.findByCourseIdOrderByCreatedAtDesc(courseId).stream().map(this::response).toList();
    }

    @Transactional
    public TaskResponse create(String courseId, TaskRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.CREATE);
        requireStaff(courseId, principal);
        CourseTaskEntity task = tasks.save(new CourseTaskEntity(UUID.randomUUID().toString(), courseId,
                requireTitle(request.title()), normalizeDescription(request.description()), request.deadline()));
        return response(task);
    }

    @Transactional
    public TaskResponse update(String taskId, TaskRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        task.update(requireTitle(request.title()),
                request.description() == null ? task.getDescription() : normalizeDescription(request.description()),
                request.deadline(), request.status());
        return response(tasks.save(task));
    }

    @Transactional
    public void deleteTask(String taskId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.DELETE);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        try {
            Path directory = attachmentDirectory(taskId);
            if (Files.isDirectory(directory)) {
                try (Stream<Path> files = Files.list(directory)) {
                    files.forEach(file -> {
                        try { Files.deleteIfExists(file); } catch (IOException exception) { throw new RuntimeException(exception); }
                    });
                }
                Files.deleteIfExists(directory);
            }
        } catch (IOException | RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "删除作业文档失败", exception);
        }
        tasks.delete(task);
    }

    @Transactional
    public List<TaskResponse> batchUpdateStatus(List<String> taskIds, String status, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.EDIT);
        TaskStatus targetStatus = TaskStatus.valueOf(status);
        List<TaskResponse> results = new java.util.ArrayList<>();
        for (String taskId : taskIds) {
            CourseTaskEntity task = requireTask(taskId);
            requireStaff(task.getCourseId(), principal);
            task.update(task.getTitle(), task.getDescription(), task.getDeadline(), targetStatus);
            results.add(response(tasks.save(task)));
        }
        return results;
    }

    @Transactional
    public void remindStudents(String taskId, String message, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        CourseEntity course = courses.findById(task.getCourseId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "课程不存在"));
        List<CourseMemberEntity> members = courseMembers.findByCourseId(task.getCourseId());
        String title = "作业提醒：" + task.getTitle();
        String content = message + "\n课程：" + course.getName();
        for (CourseMemberEntity member : members) {
            notificationService.send(member.getStudentId(), "task_remind", title, content, taskId);
        }
    }

    public TaskRuleResponse submissionRule(String taskId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        return ruleResponse(taskId);
    }

    @Transactional
    public TaskRuleResponse updateSubmissionRule(String taskId, TaskRuleRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.EDIT);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        long maxFileSizeBytes = request.maxFileSizeBytes() == null
                ? TaskSubmissionRuleEntity.DEFAULT_MAX_FILE_SIZE_BYTES
                : request.maxFileSizeBytes();
        if (maxFileSizeBytes < 1 || maxFileSizeBytes > 100L * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单个文件大小必须在 1 字节到 100 MB 之间");
        }
        TaskSubmissionRuleEntity rule = rules.findById(taskId)
                .orElseGet(() -> new TaskSubmissionRuleEntity(taskId));
        rule.update(normalizeExtensions(request.allowedExtensions()), maxFileSizeBytes,
                trimToNull(request.ruleText()), trimToNull(request.scoringRuleText()), rule.getImportedFileName());
        rules.save(rule);
        return ruleResponse(taskId);
    }

    @Transactional
    public TaskRuleResponse importSubmissionRule(String taskId, MultipartFile file, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.EDIT);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择规则文件");
        }
        String fileName = safeFileName(file.getOriginalFilename());
        String extension = extension(fileName);
        if (!extension.equals(".pdf") && !extension.equals(".docx")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "规则文件仅支持 PDF 或 DOCX 格式");
        }
        Map<String, Object> parsed = aiWorkerClient.validateDocument(file);
        String ruleText = String.valueOf(parsed.getOrDefault("text", "")).trim();
        if (ruleText.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "未从规则文件中提取到可用文本");
        }
        saveRuleSource(taskId, file, fileName);
        TaskSubmissionRuleEntity rule = rules.findById(taskId)
                .orElseGet(() -> new TaskSubmissionRuleEntity(taskId));
        rule.update(rule.getAllowedExtensions(), rule.getMaxFileSizeBytes(), ruleText, rule.getScoringRuleText(), fileName);
        rules.save(rule);
        return ruleResponse(taskId);
    }

    public TaskDescriptionImportResponse importTaskDescription(MultipartFile file, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.CREATE);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择作业介绍文件");
        }
        String fileName = safeFileName(file.getOriginalFilename());
        String extension = extension(fileName);
        if (!extension.equals(".pdf") && !extension.equals(".docx")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "作业介绍文件仅支持 PDF 或 DOCX 格式");
        }
        Map<String, Object> parsed = aiWorkerClient.validateDocument(file);
        String description = String.valueOf(parsed.getOrDefault("text", "")).trim();
        if (description.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "未从作业介绍文件中提取到可用文本");
        }
        return new TaskDescriptionImportResponse(description, fileName);
    }

    public RuleSourceDownload downloadSubmissionRuleSource(String taskId, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireTaskAccess(task, principal);
        TaskSubmissionRuleEntity rule = rules.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到规则源文件"));
        String fileName = rule.getImportedFileName();
        if (fileName == null || fileName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到规则源文件");
        }
        try {
            Path source = ruleSourceDirectory(taskId).resolve(fileName).normalize();
            if (!source.startsWith(ruleSourceDirectory(taskId)) || !Files.isRegularFile(source)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "规则源文件不存在");
            }
            return new RuleSourceDownload(fileName, new UrlResource(source.toUri()));
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "规则源文件不存在", exception);
        }
    }

    public List<StudentTaskResponse> myTasks(AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可访问个人任务");
        }
        return tasks.findAll().stream()
                .filter(task -> isVisibleToStudent(task, principal.studentId()))
                .map(task -> {
                    TaskSubmissionEntity submission = submissions.findTopByTaskIdAndStudentIdOrderBySubmittedAtDesc(task.getId(), principal.studentId()).orElse(null);
                    Double score = null;
                    if (submission != null && submission.getAnalysisJobId() != null) {
                        Map<String, Object> review = analysisReviewService.get(submission.getAnalysisJobId());
                        if (review != null && "PUBLISHED".equals(review.get("status"))) {
                            Object ruleScore = review.get("ruleScore");
                            if (ruleScore instanceof Number n) score = n.doubleValue();
                        }
                    }
                    return new StudentTaskResponse(task.getId(), task.getCourseId(), task.getTitle(), task.getDescription(),
                            task.getDeadline(), submission != null, submission == null ? null : submission.getFileName(),
                            submission == null ? null : submission.getSubmittedAt(), attachmentResponses(task.getId()), ruleResponse(task.getId()), score);
                }).toList();
    }

    public List<StudentCourseResponse> myCourses(AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可访问个人课程");
        }
        return courseMembers.findByStudentId(principal.studentId()).stream()
                .map(CourseMemberEntity::getCourseId)
                .distinct()
                .map(courses::findById)
                .flatMap(java.util.Optional::stream)
                .filter(course -> course.getStatus() == CourseStatus.ACTIVE)
                .map(course -> new StudentCourseResponse(course.getId(), course.getName(), course.getDescription()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StudentAttachmentResponse> myCourseAttachments(String courseId, AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可访问");
        }
        if (!courseMembers.existsByCourseIdAndStudentId(courseId, principal.studentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您不在该课程中");
        }
        return courseAttachments.findByCourseIdOrderByFileName(courseId).stream()
                .map(a -> new StudentAttachmentResponse(a.getId(), a.getFileName(),
                        "/api/student/courses/" + courseId + "/attachments/" + a.getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Resource downloadCourseAttachment(String courseId, String attachmentId, AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可访问");
        }
        if (!courseMembers.existsByCourseIdAndStudentId(courseId, principal.studentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您不在该课程中");
        }
        CourseAttachmentEntity attachment = courseAttachments.findById(attachmentId)
                .filter(a -> a.getCourseId().equals(courseId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "附件不存在"));
        Path file = courseAttachmentDirectory.resolve(attachment.getObjectKey()).normalize();
        if (!file.startsWith(courseAttachmentDirectory) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "附件不存在");
        }
        return new FileSystemResource(file);
    }

    @Transactional
    public StudentTaskResponse submit(String taskId, MultipartFile file, AppPrincipal principal) {
        return submit(taskId, List.of(file), principal);
    }

    @Transactional
    public StudentTaskResponse submit(String taskId, List<MultipartFile> files, AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可提交作业");
        }
        if (files == null || files.isEmpty() || files.stream().anyMatch(file -> file == null || file.isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择需要提交的文件");
        }
        CourseTaskEntity task = requireTask(taskId);
        if (!courseMembers.existsByCourseIdAndStudentId(task.getCourseId(), principal.studentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您未加入该课程");
        }
        if (task.getStatus() != TaskStatus.ACTIVE || (task.getDeadline() != null && !LocalDateTime.now().isBefore(task.getDeadline()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前任务不在可提交时间内");
        }
        TaskRuleResponse rule = ruleResponse(taskId);
        for (MultipartFile file : files) {
            String originalName = file.getOriginalFilename() == null ? "submission" : Path.of(file.getOriginalFilename()).getFileName().toString();
            validateSubmission(file, originalName, rule);
        }
        String batchId = UUID.randomUUID().toString();
        TaskSubmissionEntity latestSubmission = null;
        for (MultipartFile file : files) {
            String originalName = file.getOriginalFilename() == null ? "submission" : Path.of(file.getOriginalFilename()).getFileName().toString();
            String objectKey = task.getId() + "/" + principal.studentId() + "/" + UUID.randomUUID() + "-" + originalName;
            try (var input = file.getInputStream()) {
                storageService.uploadFile(objectKey, input,
                        file.getContentType() == null ? "application/octet-stream" : file.getContentType());
            } catch (IOException exception) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "提交文件保存失败", exception);
            }
            latestSubmission = new TaskSubmissionEntity(UUID.randomUUID().toString(), taskId, principal.studentId(), batchId, objectKey,
                    originalName, file.getContentType(), file.getSize());
            submissions.save(latestSubmission);
        }
        return new StudentTaskResponse(task.getId(), task.getCourseId(), task.getTitle(), task.getDescription(),
                task.getDeadline(), true, latestSubmission.getFileName(), latestSubmission.getSubmittedAt(), attachmentResponses(task.getId()),
                rule, null);
    }

    public List<SubmissionBatchHistoryResponse> submissionHistory(String taskId, AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可查看提交记录");
        }
        CourseTaskEntity task = requireTask(taskId);
        if (!courseMembers.existsByCourseIdAndStudentId(task.getCourseId(), principal.studentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您未加入该课程");
        }
        return submissions.findByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, principal.studentId()).stream()
                .collect(java.util.stream.Collectors.groupingBy(TaskSubmissionEntity::getSubmissionBatchId,
                        java.util.LinkedHashMap::new, java.util.stream.Collectors.toList()))
                .entrySet().stream()
                .map(entry -> new SubmissionBatchHistoryResponse(entry.getKey(), entry.getValue().get(0).getSubmittedAt(),
                        entry.getValue().stream().map(this::submissionHistoryResponse).toList()))
                .toList();
    }

    public List<SubmissionBatchHistoryResponse> studentSubmissionHistory(String taskId, String studentId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        return submissions.findByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, studentId).stream()
                .collect(java.util.stream.Collectors.groupingBy(TaskSubmissionEntity::getSubmissionBatchId,
                        java.util.LinkedHashMap::new, java.util.stream.Collectors.toList()))
                .entrySet().stream()
                .map(entry -> new SubmissionBatchHistoryResponse(entry.getKey(), entry.getValue().get(0).getSubmittedAt(),
                        entry.getValue().stream().map(this::submissionHistoryResponse).toList()))
                .toList();
    }

    public List<TeacherSubmissionResponse> teacherSubmissions(String taskId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        return submissions.findByTaskIdOrderBySubmittedAtDesc(taskId).stream()
                .map(submission -> new TeacherSubmissionResponse(submission.getId(), submission.getStudentId(),
                        submission.getSubmissionBatchId(), submission.getFileName(), submission.getSubmittedAt(),
                        "/api/submissions/" + submission.getId() + "/download", submission.getAnalysisJobId()))
                .toList();
    }

    @Transactional
    public AnalysisStartResponse startAnalysis(String taskId, String studentId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.EDIT);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        TaskSubmissionEntity latest = submissions.findTopByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "该学生尚未提交作业"));
        List<TaskSubmissionEntity> batchSubmissions = submissions.findByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, studentId).stream()
                .filter(item -> latest.getSubmissionBatchId().equals(item.getSubmissionBatchId()))
                .toList();
        List<String> objectKeys = batchSubmissions.stream().map(this::ensureSubmissionObject).toList();
        TaskSubmissionRuleEntity rule = rules.findById(taskId).orElse(null);
        String ruleText = rule == null ? "" : analysisContext(rule.getRuleText(), rule.getScoringRuleText());
        Map<String, Object> response = aiWorkerClient.submitAnalysisJob(Map.of(
                "object_keys", objectKeys,
                "rule_text", ruleText));
        Object jobId = response.get("id");
        if (jobId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "分析服务未返回任务编号");
        }
        String value = String.valueOf(jobId);
        batchSubmissions.forEach(item -> item.setAnalysisJobId(value));
        submissions.saveAll(batchSubmissions);
        return new AnalysisStartResponse(value, objectKeys.size(), "queued");
    }

    @Transactional(readOnly = true)
    public AnalysisStartResponse latestAnalysis(String taskId, String studentId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        TaskSubmissionEntity latest = submissions.findTopByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "该学生尚未提交作业"));
        String jobId = latest.getAnalysisJobId();
        if (jobId == null || jobId.isBlank()) {
            return new AnalysisStartResponse(null, 0, null);
        }
        int fileCount = (int) submissions.findByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, studentId).stream()
                .filter(item -> latest.getSubmissionBatchId().equals(item.getSubmissionBatchId())).count();
        String status = null;
        try {
            Map<String, Object> job = aiWorkerClient.analysisJob(jobId);
            status = job.get("status") == null ? null : String.valueOf(job.get("status"));
        } catch (RestClientException ignored) {
            // worker unavailable, return null status
        }
        return new AnalysisStartResponse(jobId, fileCount, status);
    }

    public void requireAnalysisJobAccess(String jobId, AppPrincipal principal) {
        if (principal.role() == UserRole.ADMIN) {
            return;
        }
        boolean allowed = submissions.findByAnalysisJobId(jobId).stream().anyMatch(submission ->
                tasks.findById(submission.getTaskId()).map(task ->
                        courseStaff.existsByCourseIdAndTeacherId(task.getCourseId(), principal.userId()))
                        .orElse(false));
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权查看该分析任务");
        }
    }

    public List<Map<String, Object>> listAnalysisTasks() {
        List<String> jobIds = submissions.findDistinctAnalysisJobIds();
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (String jobId : jobIds) {
            try {
                Map<String, Object> job = aiWorkerClient.analysisJob(jobId);
                Map<String, Object> task = new java.util.LinkedHashMap<>();
                task.put("taskId", jobId);
                task.put("fileName", job.getOrDefault("fileName", jobId));
                task.put("status", job.getOrDefault("status", "unknown"));
                task.put("progress", job.getOrDefault("progress", 0));
                result.add(task);
            } catch (RestClientException ignored) {
                // skip unavailable jobs
            }
        }
        return result;
    }

    public SubmissionDownload downloadSubmission(String submissionId, AppPrincipal principal) {
        TaskSubmissionEntity submission = submissions.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "提交文件不存在"));
        CourseTaskEntity task = requireTask(submission.getTaskId());
        if (principal.role() == UserRole.STUDENT) {
            if (principal.studentId() == null || !submission.getStudentId().equals(principal.studentId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权下载该提交文件");
            }
        } else {
            permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
            requireStaff(task.getCourseId(), principal);
        }
        try {
            return new SubmissionDownload(submission.getFileName(),
                    new InputStreamResource(storageService.openFile(submission.getObjectKey())));
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "提交文件不存在", exception);
        }
    }

    public ArchiveEntryPreview previewSubmission(String submissionId, AppPrincipal principal) {
        TaskSubmissionEntity submission = submissions.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "提交文件不存在"));
        CourseTaskEntity task = requireTask(submission.getTaskId());
        if (principal.role() == UserRole.STUDENT) {
            if (principal.studentId() == null || !submission.getStudentId().equals(principal.studentId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权预览该提交文件");
            }
        } else {
            permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
            requireStaff(task.getCourseId(), principal);
        }
        try {
            return new ArchiveEntryPreview(submission.getFileName(), submission.getContentType(),
                    new InputStreamResource(storageService.openFile(submission.getObjectKey())));
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "提交文件不存在", exception);
        }
    }

    public ArchiveEntryPreview previewArchiveEntry(String submissionId, String entryPath, AppPrincipal principal) {
        TaskSubmissionEntity submission = submissions.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "提交文件不存在"));
        CourseTaskEntity task = requireTask(submission.getTaskId());
        if (principal.role() == UserRole.STUDENT) {
            if (principal.studentId() == null || !submission.getStudentId().equals(principal.studentId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权预览该提交文件");
            }
        } else {
            permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
            requireStaff(task.getCourseId(), principal);
        }
        if (!extension(submission.getFileName()).equals(".zip")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "提交文件不是压缩包");
        }
        if (entryPath.contains("..")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "非法的文件路径");
        }
        // Try UTF-8 first, fall back to GBK for Chinese Windows zip files
        for (java.nio.charset.Charset charset : new java.nio.charset.Charset[] { java.nio.charset.StandardCharsets.UTF_8, java.nio.charset.Charset.forName("GBK") }) {
            try (ZipInputStream zip = new ZipInputStream(storageService.openFile(submission.getObjectKey()), charset)) {
                java.util.zip.ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (!entry.isDirectory() && entry.getName().equals(entryPath)) {
                        byte[] data = zip.readAllBytes();
                        String entryFileName = Path.of(entryPath).getFileName().toString();
                        String contentType = java.net.URLConnection.guessContentTypeFromName(entryFileName);
                        if (contentType == null) contentType = "application/octet-stream";
                        return new ArchiveEntryPreview(entryFileName, contentType,
                                new org.springframework.core.io.ByteArrayResource(data) {
                                    @Override public String getFilename() { return entryFileName; }
                                });
                    }
                }
            } catch (IOException | RuntimeException exception) {
                // Try next charset
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "压缩包中未找到文件: " + entryPath);
    }

    @Transactional
    public AttachmentResponse uploadAttachment(String taskId, MultipartFile file, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.EDIT);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择需要上传的文档");
        }
        String originalName = Path.of(file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename())
                .getFileName().toString();
        Path directory = attachmentDirectory(taskId);
        String storedName = UUID.randomUUID() + "-" + originalName;
        try {
            Files.createDirectories(directory);
            file.transferTo(directory.resolve(storedName));
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "作业文档保存失败", exception);
        }
        String baseUrl = "/api/tasks/" + taskId + "/attachments/" + storedName;
        return new AttachmentResponse(originalName, baseUrl, baseUrl);
    }

    public List<AttachmentResponse> attachments(String taskId, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireTaskAccess(task, principal);
        return attachmentResponses(taskId);
    }

    public Resource downloadAttachment(String taskId, String fileName, AppPrincipal principal) {
        CourseTaskEntity task = requireTask(taskId);
        requireTaskAccess(task, principal);
        try {
            Path file = attachmentDirectory(taskId).resolve(fileName).normalize();
            if (!file.startsWith(attachmentDirectory(taskId)) || !Files.isRegularFile(file)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业文档不存在");
            }
            return new UrlResource(file.toUri());
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业文档不存在", exception);
        }
    }

    @Transactional
    public void deleteAttachment(String taskId, String fileName, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.EDIT);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        try {
            Path file = attachmentDirectory(taskId).resolve(fileName).normalize();
            if (!file.startsWith(attachmentDirectory(taskId)) || !Files.deleteIfExists(file)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业文档不存在");
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "删除作业文档失败", exception);
        }
    }

    private CourseTaskEntity requireTask(String taskId) {
        return tasks.findById(taskId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "任务不存在"));
    }

    private boolean isVisibleToStudent(CourseTaskEntity task, String studentId) {
        if (task.getStatus() != TaskStatus.ACTIVE
                || (task.getDeadline() != null && !LocalDateTime.now().isBefore(task.getDeadline()))
                || !courseMembers.existsByCourseIdAndStudentId(task.getCourseId(), studentId)) {
            return false;
        }
        return courses.findById(task.getCourseId())
                .map(course -> course.getStatus() == CourseStatus.ACTIVE)
                .orElse(false);
    }

    private void requireStaff(String courseId, AppPrincipal principal) {
        if (!courses.existsById(courseId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程不存在");
        }
        if (principal.role() != UserRole.ADMIN && !courseStaff.existsByCourseIdAndTeacherId(courseId, principal.userId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您不在该课程教学团队中");
        }
    }

    private void requireTaskAccess(CourseTaskEntity task, AppPrincipal principal) {
        if (principal.role() == UserRole.STUDENT) {
            if (principal.studentId() == null || !courseMembers.existsByCourseIdAndStudentId(task.getCourseId(), principal.studentId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您未加入该课程");
            }
            return;
        }
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.VIEW);
        requireStaff(task.getCourseId(), principal);
    }

    private Path attachmentDirectory(String taskId) {
        return uploadDirectory.resolve("task-attachments").resolve(taskId).normalize();
    }

    private Path ruleSourceDirectory(String taskId) {
        return uploadDirectory.resolve("task-rule-sources").resolve(taskId).normalize();
    }

    private void saveRuleSource(String taskId, MultipartFile file, String fileName) {
        Path directory = ruleSourceDirectory(taskId);
        try {
            Files.createDirectories(directory);
            try (Stream<Path> files = Files.list(directory)) {
                files.forEach(existing -> {
                    try {
                        Files.deleteIfExists(existing);
                    } catch (IOException exception) {
                        throw new RuntimeException(exception);
                    }
                });
            }
            file.transferTo(directory.resolve(fileName));
        } catch (IOException | RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "规则源文件保存失败", exception);
        }
    }

    private List<AttachmentResponse> attachmentResponses(String taskId) {
        Path directory = attachmentDirectory(taskId);
        if (!Files.isDirectory(directory)) {
            return List.of();
        }
        try (Stream<Path> files = Files.list(directory)) {
            return files.filter(Files::isRegularFile).map(file -> {
                String storedName = file.getFileName().toString();
                String originalName = storedName.length() > 37 && storedName.charAt(36) == '-'
                        ? storedName.substring(37)
                        : storedName;
                String baseUrl = "/api/tasks/" + taskId + "/attachments/" + storedName;
                return new AttachmentResponse(originalName, baseUrl, baseUrl);
            }).toList();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "读取作业文档失败", exception);
        }
    }

    private SubmissionHistoryResponse submissionHistoryResponse(TaskSubmissionEntity submission) {
        return new SubmissionHistoryResponse(submission.getId(), submission.getFileName(), submission.getSubmittedAt(),
                "/api/submissions/" + submission.getId() + "/download", archiveEntries(submission));
    }

    private List<String> archiveEntries(TaskSubmissionEntity submission) {
        if (!extension(submission.getFileName()).equals(".zip")) {
            return List.of();
        }
        // Try UTF-8 first, fall back to GBK for Chinese Windows zip files
        for (java.nio.charset.Charset charset : new java.nio.charset.Charset[] { java.nio.charset.StandardCharsets.UTF_8, java.nio.charset.Charset.forName("GBK") }) {
            try (ZipInputStream zip = new ZipInputStream(storageService.openFile(submission.getObjectKey()), charset)) {
                List<String> entries = new java.util.ArrayList<>();
                java.util.zip.ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null && entries.size() < 500) {
                    if (!entry.isDirectory()) {
                        entries.add(entry.getName());
                    }
                }
                return entries;
            } catch (IOException | RuntimeException exception) {
                // Try next charset
            }
        }
        return List.of();
    }

    private String ensureSubmissionObject(TaskSubmissionEntity submission) {
        String objectKey = submission.getObjectKey();
        if (storageService.fileExists(objectKey)) {
            return objectKey;
        }
        Path legacyFile = uploadDirectory.resolve(objectKey).normalize();
        if (!legacyFile.startsWith(uploadDirectory) || !Files.isRegularFile(legacyFile)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "提交文件不存在");
        }
        try (var input = Files.newInputStream(legacyFile)) {
            storageService.uploadFile(objectKey, input,
                    submission.getContentType() == null ? "application/octet-stream" : submission.getContentType());
            return objectKey;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "提交文件迁移到对象存储失败", exception);
        }
    }

    private TaskResponse response(CourseTaskEntity task) {
        return new TaskResponse(task.getId(), task.getCourseId(), task.getTitle(), task.getDescription(), task.getDeadline(),
                task.getStatus(), task.getCreatedAt(), attachmentResponses(task.getId()));
    }

    private TaskRuleResponse ruleResponse(String taskId) {
        return rules.findById(taskId)
                .map(rule -> new TaskRuleResponse(parseExtensions(rule.getAllowedExtensions()), rule.getMaxFileSizeBytes(), rule.getRuleText(),
                        rule.getScoringRuleText(),
                        rule.getImportedFileName(), rule.getImportedAt(),
                        rule.getImportedFileName() == null ? null : "/api/tasks/" + taskId + "/submission-rule/source"))
                .orElseGet(() -> new TaskRuleResponse(List.of(), TaskSubmissionRuleEntity.DEFAULT_MAX_FILE_SIZE_BYTES, null, null, null, null, null));
    }

    private String normalizeExtensions(List<String> values) {
        if (values == null) {
            return "";
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .map(value -> value.startsWith(".") ? value : "." + value)
                .distinct()
                .collect(Collectors.joining(","));
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String analysisContext(String assignmentRequirements, String scoringRules) {
        List<String> sections = new ArrayList<>();
        String requirements = trimToNull(assignmentRequirements);
        String scoring = trimToNull(scoringRules);
        if (requirements != null) {
            sections.add("Assignment requirements:\n" + requirements);
        }
        if (scoring != null) {
            sections.add("Scoring rubric:\n" + scoring);
        }
        return String.join("\n\n", sections);
    }

    private void validateSubmission(MultipartFile file, String fileName, TaskRuleResponse rule) {
        if (file.getSize() > rule.maxFileSizeBytes()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "上传文件超过作业允许的最大大小");
        }
        String extension = extension(fileName);
        if (!rule.allowedExtensions().isEmpty() && !rule.allowedExtensions().contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "不支持该文件类型，允许：" + String.join("、", rule.allowedExtensions()));
        }
    }

    private String extension(String fileName) {
        int index = fileName.lastIndexOf('.');
        return index < 0 ? "" : fileName.substring(index).toLowerCase(Locale.ROOT);
    }

    private String safeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "规则文件名不能为空");
        }
        return Path.of(fileName).getFileName().toString();
    }

    private String requireTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "作业名称不能为空");
        }
        return title.trim();
    }

    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }

    private List<String> parseExtensions(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> value.startsWith(".") ? value.toLowerCase(Locale.ROOT) : "." + value.toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    // ── Submission Comments ──

    @Transactional
    public CommentResponse addStudentComment(String taskId, String content, MultipartFile file, AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可留言");
        }
        if (content == null || content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "留言内容不能为空");
        }
        TaskSubmissionEntity submission = submissions.findTopByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, principal.studentId()).orElse(null);
        if (submission == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您尚未提交该作业");
        }
        SubmissionCommentEntity comment = new SubmissionCommentEntity(
                UUID.randomUUID().toString(), taskId, principal.studentId(), "STUDENT", principal.username(), content.trim());
        saveCommentAttachment(comment, file);
        SubmissionCommentEntity saved = comments.save(comment);
        return commentResponse(saved);
    }

    @Transactional
    public CommentResponse addTeacherComment(String taskId, String studentId, String content, MultipartFile file, AppPrincipal principal) {
        CourseTaskEntity task = tasks.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在"));
        requireTaskAccess(task, principal);
        if (content == null || content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "留言内容不能为空");
        }
        SubmissionCommentEntity comment = new SubmissionCommentEntity(
                UUID.randomUUID().toString(), taskId, studentId, "TEACHER", principal.username(), content.trim());
        saveCommentAttachment(comment, file);
        SubmissionCommentEntity saved = comments.save(comment);
        return commentResponse(saved);
    }

    private void saveCommentAttachment(SubmissionCommentEntity comment, MultipartFile file) {
        if (file == null || file.isEmpty()) return;
        String originalName = file.getOriginalFilename() == null ? "attachment" : Path.of(file.getOriginalFilename()).getFileName().toString();
        String objectKey = "comments/" + comment.getId() + "/" + UUID.randomUUID() + "-" + originalName;
        try (var input = file.getInputStream()) {
            storageService.uploadFile(objectKey, input,
                    file.getContentType() == null ? "application/octet-stream" : file.getContentType());
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "附件上传失败", exception);
        }
        comment.setAttachmentObjectKey(objectKey);
        comment.setAttachmentFileName(originalName);
        comment.setAttachmentContentType(file.getContentType());
    }

    private CommentResponse commentResponse(SubmissionCommentEntity c) {
        String attachmentUrl = c.getAttachmentObjectKey() != null
                ? "/api/comments/" + c.getId() + "/attachment" : null;
        return new CommentResponse(c.getId(), c.getAuthorRole(), c.getAuthorName(), c.getContent(), c.getCreatedAt(),
                c.getAttachmentFileName(), attachmentUrl);
    }

    public CommentDownload downloadCommentAttachment(String commentId, AppPrincipal principal) {
        SubmissionCommentEntity comment = comments.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "留言不存在"));
        if (comment.getAttachmentObjectKey() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "该留言没有附件");
        }
        // Verify access: student can only access their own, teacher can access if they have task access
        CourseTaskEntity task = tasks.findById(comment.getTaskId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在"));
        requireTaskAccess(task, principal);
        try {
            return new CommentDownload(comment.getAttachmentFileName(),
                    new InputStreamResource(storageService.openFile(comment.getAttachmentObjectKey())));
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "附件文件不存在", exception);
        }
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getStudentComments(String taskId, AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可访问");
        }
        return comments.findByTaskIdAndStudentIdOrderByCreatedAtAsc(taskId, principal.studentId()).stream()
                .map(this::commentResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getTeacherComments(String taskId, String studentId, AppPrincipal principal) {
        CourseTaskEntity task = tasks.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在"));
        requireTaskAccess(task, principal);
        return comments.findByTaskIdAndStudentIdOrderByCreatedAtAsc(taskId, studentId).stream()
                .map(this::commentResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public StudentFeedbackResponse getStudentFeedback(String taskId, AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可访问");
        }
        // Find the latest submission to get the analysisJobId
        TaskSubmissionEntity submission = submissions.findTopByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, principal.studentId()).orElse(null);
        if (submission == null || submission.getAnalysisJobId() == null) {
            return new StudentFeedbackResponse(null, null, null, null, null);
        }
        Map<String, Object> review = analysisReviewService.get(submission.getAnalysisJobId());
        if (review == null) {
            return new StudentFeedbackResponse(null, null, null, null, null);
        }
        String status = (String) review.get("status");
        if (!"PUBLISHED".equals(status)) {
            return new StudentFeedbackResponse(null, null, null, null, status);
        }
        return new StudentFeedbackResponse(
                review.get("ruleScore"),
                review.get("qualityReferenceScore"),
                review.get("comment"),
                review.get("publishedAt"),
                status
        );
    }

    public record TaskRequest(String title, String description, LocalDateTime deadline, TaskStatus status) {}
    public record TaskRuleRequest(List<String> allowedExtensions, Long maxFileSizeBytes, String ruleText, String scoringRuleText) {}
    public record TaskDescriptionImportResponse(String description, String fileName) {}
    public record RuleSourceDownload(String fileName, Resource resource) {}
    public record SubmissionDownload(String fileName, Resource resource) {}
    public record ArchiveEntryPreview(String fileName, String contentType, Resource resource) {}
    public record AttachmentResponse(String fileName, String downloadUrl, String deleteUrl) {}
    public record TaskResponse(String id, String courseId, String title, String description, LocalDateTime deadline, TaskStatus status,
                               LocalDateTime createdAt, List<AttachmentResponse> attachments) {}
    public record StudentTaskResponse(String id, String courseId, String title, String description, LocalDateTime deadline,
                                      boolean submitted, String fileName, LocalDateTime submittedAt,
                                      List<AttachmentResponse> attachments, TaskRuleResponse submissionRule, Double score) {}
    public record TaskRuleResponse(List<String> allowedExtensions, long maxFileSizeBytes, String ruleText, String scoringRuleText,
                                   String importedFileName, LocalDateTime importedAt, String importedDownloadUrl) {}
    public record SubmissionHistoryResponse(String id, String fileName, LocalDateTime submittedAt, String downloadUrl,
                                            List<String> archiveEntries) {}
    public record SubmissionBatchHistoryResponse(String id, LocalDateTime submittedAt, List<SubmissionHistoryResponse> files) {}
    public record TeacherSubmissionResponse(String id, String studentId, String submissionBatchId, String fileName, LocalDateTime submittedAt,
                                            String downloadUrl, String analysisJobId) {}
    public record AnalysisStartResponse(String jobId, int fileCount, String status) {}
    public record StudentCourseResponse(String id, String name, String description) {}
    public record StudentAttachmentResponse(String id, String fileName, String downloadUrl) {}
    public record CommentResponse(String id, String authorRole, String authorName, String content, LocalDateTime createdAt,
                                  String attachmentFileName, String attachmentUrl) {}
    public record CommentDownload(String fileName, Resource resource) {}
    public record StudentFeedbackResponse(Object ruleScore, Object qualityReferenceScore, Object comment, Object publishedAt, String status) {}
}
