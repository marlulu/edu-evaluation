package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import com.example.eduevaluation.auth.UserRole;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
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
    private final ModulePermissionService permissions;
    private final Path uploadDirectory;

    public CourseTaskService(
            CourseRepository courses,
            CourseStaffRepository courseStaff,
            CourseMemberRepository courseMembers,
            CourseTaskRepository tasks,
            TaskSubmissionRepository submissions,
            ModulePermissionService permissions,
            @Value("${app.upload-dir:data/uploads}") String uploadDirectory
    ) {
        this.courses = courses; this.courseStaff = courseStaff; this.courseMembers = courseMembers;
        this.tasks = tasks; this.submissions = submissions; this.permissions = permissions;
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
                request.title().trim(), request.description().trim(), request.deadline()));
        return response(task);
    }

    @Transactional
    public TaskResponse update(String taskId, TaskRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.TASK, ModuleAction.EDIT);
        CourseTaskEntity task = requireTask(taskId);
        requireStaff(task.getCourseId(), principal);
        task.update(request.title().trim(), request.description().trim(), request.deadline(), request.status());
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

    public List<StudentTaskResponse> myTasks(AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可访问个人任务");
        }
        return tasks.findAll().stream()
                .filter(task -> isVisibleToStudent(task, principal.studentId()))
                .map(task -> {
                    TaskSubmissionEntity submission = submissions.findByTaskIdAndStudentId(task.getId(), principal.studentId()).orElse(null);
                    return new StudentTaskResponse(task.getId(), task.getCourseId(), task.getTitle(), task.getDescription(),
                            task.getDeadline(), submission != null, submission == null ? null : submission.getFileName(),
                            submission == null ? null : submission.getSubmittedAt(), attachmentResponses(task.getId()));
                }).toList();
    }

    @Transactional
    public StudentTaskResponse submit(String taskId, MultipartFile file, AppPrincipal principal) {
        if (principal.role() != UserRole.STUDENT || principal.studentId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅学生可提交作业");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择需要提交的文件");
        }
        CourseTaskEntity task = requireTask(taskId);
        if (!courseMembers.existsByCourseIdAndStudentId(task.getCourseId(), principal.studentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您未加入该课程");
        }
        if (task.getStatus() != TaskStatus.ACTIVE || (task.getDeadline() != null && !LocalDateTime.now().isBefore(task.getDeadline()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前任务不在可提交时间内");
        }
        String originalName = file.getOriginalFilename() == null ? "submission" : Path.of(file.getOriginalFilename()).getFileName().toString();
        String objectKey = task.getId() + "/" + principal.studentId() + "/" + UUID.randomUUID() + "-" + originalName;
        try {
            Path destination = uploadDirectory.resolve(objectKey).normalize();
            if (!destination.startsWith(uploadDirectory)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件名不合法");
            }
            Files.createDirectories(destination.getParent());
            file.transferTo(destination);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "提交文件保存失败", exception);
        }
        TaskSubmissionEntity submission = submissions.findByTaskIdAndStudentId(taskId, principal.studentId())
                .orElseGet(() -> new TaskSubmissionEntity(UUID.randomUUID().toString(), taskId, principal.studentId(), objectKey, originalName));
        submission.replace(objectKey, originalName);
        submissions.save(submission);
        return new StudentTaskResponse(task.getId(), task.getCourseId(), task.getTitle(), task.getDescription(),
                task.getDeadline(), true, submission.getFileName(), submission.getSubmittedAt(), attachmentResponses(task.getId()));
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

    private TaskResponse response(CourseTaskEntity task) {
        return new TaskResponse(task.getId(), task.getCourseId(), task.getTitle(), task.getDescription(), task.getDeadline(), task.getStatus(), attachmentResponses(task.getId()));
    }

    public record TaskRequest(String title, String description, LocalDateTime deadline, TaskStatus status) {}
    public record AttachmentResponse(String fileName, String downloadUrl, String deleteUrl) {}
    public record TaskResponse(String id, String courseId, String title, String description, LocalDateTime deadline, TaskStatus status,
                               List<AttachmentResponse> attachments) {}
    public record StudentTaskResponse(String id, String courseId, String title, String description, LocalDateTime deadline,
                                      boolean submitted, String fileName, LocalDateTime submittedAt,
                                      List<AttachmentResponse> attachments) {}
}
