package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.core.io.Resource;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    @GetMapping
    public List<CourseResponse> list(@RequestParam(required = false) CourseStatus status, @AuthenticationPrincipal AppPrincipal principal) {
        return courseService.list(status, principal);
    }

    @GetMapping("/{courseId}")
    public CourseResponse get(@PathVariable String courseId, @AuthenticationPrincipal AppPrincipal principal) {
        return courseService.get(courseId, principal);
    }

    @GetMapping("/options")
    public CourseOptionsResponse options(@AuthenticationPrincipal AppPrincipal principal) {
        return courseService.options(principal);
    }

    @GetMapping("/{courseId}/students")
    public List<CourseStudentOption> students(@PathVariable String courseId, @AuthenticationPrincipal AppPrincipal principal) {
        return courseService.students(courseId, principal);
    }

    @PostMapping("/{courseId}/students")
    public ResponseEntity<CourseStudentOption> addStudent(
            @PathVariable String courseId,
            @Valid @RequestBody CourseStudentRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        CourseStudentOption student = courseService.addStudent(courseId, request, principal);
        return ResponseEntity.created(URI.create("/api/courses/" + courseId + "/students/" + student.id())).body(student);
    }

    @PostMapping("/{courseId}/student-groups")
    public List<CourseStudentOption> addStudentGroups(
            @PathVariable String courseId,
            @Valid @RequestBody CourseStudentGroupRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return courseService.addStudentGroups(courseId, request, principal);
    }

    @DeleteMapping("/{courseId}/students/{studentId}")
    public ResponseEntity<Void> removeStudent(
            @PathVariable String courseId,
            @PathVariable String studentId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        courseService.removeStudent(courseId, studentId, principal);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{courseId}/attachments")
    public CourseService.CourseAttachmentResponse uploadAttachment(@PathVariable String courseId, @RequestParam("file") MultipartFile file, @AuthenticationPrincipal AppPrincipal principal) {
        return courseService.uploadAttachment(courseId, file, principal);
    }

    @GetMapping("/{courseId}/attachments")
    public List<CourseService.CourseAttachmentResponse> attachments(@PathVariable String courseId, @AuthenticationPrincipal AppPrincipal principal) {
        return courseService.attachments(courseId, principal);
    }

    @GetMapping("/{courseId}/attachments/{attachmentId}")
    public ResponseEntity<Resource> downloadAttachment(@PathVariable String courseId, @PathVariable String attachmentId, @AuthenticationPrincipal AppPrincipal principal) {
        Resource file = courseService.downloadAttachment(courseId, attachmentId, principal);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment").body(file);
    }

    @PostMapping
    public ResponseEntity<CourseResponse> create(@Valid @RequestBody CreateCourseRequest request, @AuthenticationPrincipal AppPrincipal principal) {
        CourseResponse course = courseService.create(request, principal);
        return ResponseEntity.created(URI.create("/api/courses/" + course.id())).body(course);
    }

    @PutMapping("/{courseId}")
    public CourseResponse update(
            @PathVariable String courseId,
            @Valid @RequestBody UpdateCourseRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return courseService.update(courseId, request, principal);
    }

    @PutMapping("/{courseId}/status")
    public CourseResponse updateStatus(
            @PathVariable String courseId,
            @Valid @RequestBody CourseStatusRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return courseService.updateStatus(courseId, request.status(), principal);
    }

    @DeleteMapping("/{courseId}")
    public ResponseEntity<Void> delete(@PathVariable String courseId, @AuthenticationPrincipal AppPrincipal principal) {
        courseService.delete(courseId, principal);
        return ResponseEntity.noContent().build();
    }
}
