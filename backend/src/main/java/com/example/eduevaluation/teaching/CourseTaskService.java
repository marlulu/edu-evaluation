package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.common.AiWorkerClient;
import com.example.eduevaluation.common.StorageService;
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
import org.springframework.core.io.Resource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
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
    private final ModulePermissionService permissions;
    private final AiWorkerClient aiWorkerClient;
    private final StorageService storageService;
    private final Path uploadDirectory;

    public CourseTaskService(
            CourseRepository courses,
            CourseStaffRepository courseStaff,
            CourseMemberRepository courseMembers,
            CourseTaskRepository tasks,
            TaskSubmissionRepository submissions,
            TaskSubmissionRuleRepository rules,
            ModulePermissionService permissions,
            AiWorkerClient aiWorkerClient,
            StorageService storageService,
            @Value("${app.upload-dir:data/uploads}") String uploadDirectory
    ) {
        this.courses = courses; this.courseStaff = courseStaff; this.courseMembers = courseMembers;
        this.tasks = tasks; this.submissions = submissions; this.rules = rules; this.permissions = permissions;
        this.aiWorkerClient = aiWorkerClient;
        this.storageService = storageService;
        this.uploadDirectory = Path.of(uploadDirectory, "task-submissions").toAbsolutePath().normalize();
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
                    return new StudentTaskResponse(task.getId(), task.getCourseId(), task.getTitle(), task.getDescription(),
                            task.getDeadline(), submission != null, submission == null ? null : submission.getFileName(),
                            submission == null ? null : submission.getSubmittedAt(), attachmentResponses(task.getId()), ruleResponse(task.getId()));
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
                rule);
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
        return new AnalysisStartResponse(value, objectKeys.size());
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
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "该学生尚未开始智能分析");
        }
        return new AnalysisStartResponse(jobId, (int) submissions.findByTaskIdAndStudentIdOrderBySubmittedAtDesc(taskId, studentId).stream()
                .filter(item -> latest.getSubmissionBatchId().equals(item.getSubmissionBatchId())).count());
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
        try (ZipInputStream zip = new ZipInputStream(storageService.openFile(submission.getObjectKey()))) {
            List<String> entries = new java.util.ArrayList<>();
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null && entries.size() < 500) {
                if (!entry.isDirectory()) {
                    entries.add(entry.getName());
                }
            }
            return entries;
        } catch (IOException | RuntimeException exception) {
            return List.of();
        }
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

    public record TaskRequest(String title, String description, LocalDateTime deadline, TaskStatus status) {}
    public record TaskRuleRequest(List<String> allowedExtensions, Long maxFileSizeBytes, String ruleText, String scoringRuleText) {}
    public record TaskDescriptionImportResponse(String description, String fileName) {}
    public record RuleSourceDownload(String fileName, Resource resource) {}
    public record SubmissionDownload(String fileName, Resource resource) {}
    public record AttachmentResponse(String fileName, String downloadUrl, String deleteUrl) {}
    public record TaskResponse(String id, String courseId, String title, String description, LocalDateTime deadline, TaskStatus status,
                               LocalDateTime createdAt, List<AttachmentResponse> attachments) {}
    public record StudentTaskResponse(String id, String courseId, String title, String description, LocalDateTime deadline,
                                      boolean submitted, String fileName, LocalDateTime submittedAt,
                                      List<AttachmentResponse> attachments, TaskRuleResponse submissionRule) {}
    public record TaskRuleResponse(List<String> allowedExtensions, long maxFileSizeBytes, String ruleText, String scoringRuleText,
                                   String importedFileName, LocalDateTime importedAt, String importedDownloadUrl) {}
    public record SubmissionHistoryResponse(String id, String fileName, LocalDateTime submittedAt, String downloadUrl,
                                            List<String> archiveEntries) {}
    public record SubmissionBatchHistoryResponse(String id, LocalDateTime submittedAt, List<SubmissionHistoryResponse> files) {}
    public record TeacherSubmissionResponse(String id, String studentId, String submissionBatchId, String fileName, LocalDateTime submittedAt,
                                            String downloadUrl, String analysisJobId) {}
    public record AnalysisStartResponse(String jobId, int fileCount) {}
    public record StudentCourseResponse(String id, String name, String description) {}
}
