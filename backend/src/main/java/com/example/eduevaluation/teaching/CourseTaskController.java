package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class CourseTaskController {
    private final CourseTaskService service;

    public CourseTaskController(CourseTaskService service) {
        this.service = service;
    }

    @GetMapping("/courses/{courseId}/tasks")
    public List<CourseTaskService.TaskResponse> list(
            @PathVariable String courseId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.listForCourse(courseId, principal);
    }

    @PostMapping("/courses/{courseId}/tasks")
    public ResponseEntity<CourseTaskService.TaskResponse> create(
            @PathVariable String courseId,
            @Valid @RequestBody CourseTaskService.TaskRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        CourseTaskService.TaskResponse task = service.create(courseId, request, principal);
        return ResponseEntity.created(URI.create("/api/tasks/" + task.id())).body(task);
    }

    @PutMapping("/tasks/{taskId}")
    public CourseTaskService.TaskResponse update(
            @PathVariable String taskId,
            @Valid @RequestBody CourseTaskService.TaskRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.update(taskId, request, principal);
    }

    @DeleteMapping("/tasks/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable String taskId, @AuthenticationPrincipal AppPrincipal principal) {
        service.deleteTask(taskId, principal);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tasks/{taskId}/submission-rule")
    public CourseTaskService.TaskRuleResponse submissionRule(
            @PathVariable String taskId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.submissionRule(taskId, principal);
    }

    @PutMapping("/tasks/{taskId}/submission-rule")
    public CourseTaskService.TaskRuleResponse updateSubmissionRule(
            @PathVariable String taskId,
            @RequestBody CourseTaskService.TaskRuleRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.updateSubmissionRule(taskId, request, principal);
    }

    @PostMapping("/tasks/{taskId}/submission-rule/import")
    public CourseTaskService.TaskRuleResponse importSubmissionRule(
            @PathVariable String taskId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.importSubmissionRule(taskId, file, principal);
    }

    @PostMapping("/tasks/description/import")
    public CourseTaskService.TaskDescriptionImportResponse importTaskDescription(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.importTaskDescription(file, principal);
    }

    @GetMapping("/tasks/{taskId}/submission-rule/source")
    public ResponseEntity<Resource> downloadSubmissionRuleSource(
            @PathVariable String taskId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        CourseTaskService.RuleSourceDownload source = service.downloadSubmissionRuleSource(taskId, principal);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + source.fileName() + "\"")
                .body(source.resource());
    }

    @PostMapping("/tasks/{taskId}/attachments")
    public CourseTaskService.AttachmentResponse uploadAttachment(
            @PathVariable String taskId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.uploadAttachment(taskId, file, principal);
    }

    @GetMapping("/tasks/{taskId}/attachments")
    public List<CourseTaskService.AttachmentResponse> attachments(
            @PathVariable String taskId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.attachments(taskId, principal);
    }

    @GetMapping("/tasks/{taskId}/attachments/{fileName:.+}")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable String taskId,
            @PathVariable String fileName,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        Resource resource = service.downloadAttachment(taskId, fileName, principal);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .body(resource);
    }

    @DeleteMapping("/tasks/{taskId}/attachments/{fileName:.+}")
    public ResponseEntity<Void> deleteAttachment(
            @PathVariable String taskId,
            @PathVariable String fileName,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        service.deleteAttachment(taskId, fileName, principal);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/student/tasks")
    public List<CourseTaskService.StudentTaskResponse> mine(@AuthenticationPrincipal AppPrincipal principal) {
        return service.myTasks(principal);
    }

    @GetMapping("/student/courses")
    public List<CourseTaskService.StudentCourseResponse> myCourses(@AuthenticationPrincipal AppPrincipal principal) {
        return service.myCourses(principal);
    }

    @PostMapping("/student/tasks/{taskId}/submission")
    public CourseTaskService.StudentTaskResponse submit(
            @PathVariable String taskId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.submit(taskId, file, principal);
    }

    @PostMapping("/student/tasks/{taskId}/submissions")
    public CourseTaskService.StudentTaskResponse submitBatch(
            @PathVariable String taskId,
            @RequestParam("files") List<MultipartFile> files,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.submit(taskId, files, principal);
    }

    @GetMapping("/student/tasks/{taskId}/submissions")
    public List<CourseTaskService.SubmissionBatchHistoryResponse> submissionHistory(
            @PathVariable String taskId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.submissionHistory(taskId, principal);
    }

    @GetMapping("/tasks/{taskId}/submissions")
    public List<CourseTaskService.TeacherSubmissionResponse> teacherSubmissions(
            @PathVariable String taskId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.teacherSubmissions(taskId, principal);
    }

    @PostMapping("/tasks/{taskId}/students/{studentId}/analysis")
    public CourseTaskService.AnalysisStartResponse startAnalysis(
            @PathVariable String taskId,
            @PathVariable String studentId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.startAnalysis(taskId, studentId, principal);
    }

    @GetMapping("/tasks/{taskId}/students/{studentId}/analysis")
    public CourseTaskService.AnalysisStartResponse latestAnalysis(
            @PathVariable String taskId,
            @PathVariable String studentId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.latestAnalysis(taskId, studentId, principal);
    }

    @GetMapping("/submissions/{submissionId}/download")
    public ResponseEntity<Resource> downloadSubmission(
            @PathVariable String submissionId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        CourseTaskService.SubmissionDownload download = service.downloadSubmission(submissionId, principal);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + download.fileName() + "\"")
                .body(download.resource());
    }
}
