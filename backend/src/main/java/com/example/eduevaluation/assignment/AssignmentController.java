package com.example.eduevaluation.assignment;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
@RequestMapping("/api/assignment-management")
public class AssignmentController {

    private final AssignmentService service;

    public AssignmentController(AssignmentService service) {
        this.service = service;
    }

    @GetMapping("/classes")
    public List<CourseClass> classes() {
        return service.listClasses();
    }

    @PostMapping("/classes")
    public CourseClass createClass(@RequestBody ClassRequest request) {
        return service.createClass(request);
    }

    @PutMapping("/classes/{id}")
    public CourseClass updateClass(@PathVariable String id, @RequestBody ClassRequest request) {
        return service.updateClass(id, request);
    }

    @DeleteMapping("/classes/{id}")
    public void deleteClass(@PathVariable String id) {
        service.deleteClass(id);
    }

    @GetMapping("/students")
    public List<Student> students() {
        return service.listStudents();
    }

    @PostMapping("/students")
    public Student createStudent(@RequestBody StudentRequest request) {
        return service.createStudent(request);
    }

    @PutMapping("/students/{id}")
    public Student updateStudent(@PathVariable String id, @RequestBody StudentRequest request) {
        return service.updateStudent(id, request);
    }

    @DeleteMapping("/students/{id}")
    public void deleteStudent(@PathVariable String id) {
        service.deleteStudent(id);
    }

    @GetMapping("/categories")
    public List<AssignmentCategory> categories() {
        return service.listCategories();
    }

    @PostMapping("/categories")
    public AssignmentCategory createCategory(@RequestBody CategoryRequest request) {
        return service.createCategory(request);
    }

    @PutMapping("/categories/{id}")
    public AssignmentCategory updateCategory(@PathVariable String id, @RequestBody CategoryRequest request) {
        return service.updateCategory(id, request);
    }

    @DeleteMapping("/categories/{id}")
    public void deleteCategory(@PathVariable String id) {
        service.deleteCategory(id);
    }

    @GetMapping("/assignments")
    public List<Assignment> assignments() {
        return service.listAssignments();
    }

    @PostMapping("/assignments")
    public Assignment createAssignment(@RequestBody AssignmentRequest request) {
        return service.createAssignment(request);
    }

    @PutMapping("/assignments/{id}")
    public Assignment updateAssignment(@PathVariable String id, @RequestBody AssignmentRequest request) {
        return service.updateAssignment(id, request);
    }

    @DeleteMapping("/assignments/{id}")
    public void deleteAssignment(@PathVariable String id) {
        service.deleteAssignment(id);
    }

    @PostMapping(value = "/assignments/{id}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Assignment uploadVersion(
        @PathVariable String id,
        @RequestParam String studentId,
        @RequestParam(required = false) String note,
        @RequestParam MultipartFile file
    ) {
        return service.uploadVersion(id, studentId, note, file);
    }

    @PostMapping(value = "/assignments/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AssignmentImportResult importAssignments(@RequestParam MultipartFile file) throws Exception {
        return service.importAssignments(new String(file.getBytes(), StandardCharsets.UTF_8));
    }

    @GetMapping("/assignments/export")
    public ResponseEntity<byte[]> exportAssignments() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv;charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("assignments.csv", StandardCharsets.UTF_8).build());
        return ResponseEntity.ok().headers(headers).body(service.exportAssignments());
    }
}

