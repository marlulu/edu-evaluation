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

    @PostMapping("/student/tasks/{taskId}/submission")
    public CourseTaskService.StudentTaskResponse submit(
            @PathVariable String taskId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.submit(taskId, file, principal);
    }
}
