package com.example.eduevaluation.batchimport;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/classes/{classId}/batch-imports")
public class BatchImportController {

    private final BatchImportService service;

    public BatchImportController(BatchImportService service) {
        this.service = service;
    }

    @PostMapping("/preview")
    public Map<String, Object> preview(
            @PathVariable String classId,
            @RequestParam String assignmentId,
            @RequestParam("archive") MultipartFile archive) {
        return service.preview(classId, assignmentId, archive);
    }

    @PostMapping("/{batchId}/confirm")
    public Map<String, Object> confirm(
            @PathVariable String classId,
            @PathVariable String batchId) {
        return service.confirm(classId, batchId);
    }

    @GetMapping("/{batchId}")
    public Map<String, Object> status(
            @PathVariable String classId,
            @PathVariable String batchId) {
        return service.get(classId, batchId);
    }
}
