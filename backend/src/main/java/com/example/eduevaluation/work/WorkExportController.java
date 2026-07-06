package com.example.eduevaluation.work;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/work")
public class WorkExportController {

    private final WorkExportService exportService;

    public WorkExportController(WorkExportService exportService) {
        this.exportService = exportService;
    }

    @PostMapping("/export/pdf")
    public ResponseEntity<byte[]> exportToPdf(@RequestBody Map<String, List<String>> request) {
        List<String> taskIds = request.get("taskIds");
        if (taskIds == null || taskIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] pdfBytes = exportService.exportToPdf(taskIds);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "作品分析报告_" + timestamp + ".pdf";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdfBytes.length)
                    .body(pdfBytes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/export/pdf/class/{classId}")
    public ResponseEntity<byte[]> exportByClass(@PathVariable String classId) {
        try {
            byte[] pdfBytes = exportService.exportByClass(classId);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "班级作品报告_" + timestamp + ".pdf";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdfBytes.length)
                    .body(pdfBytes);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/export/pdf/student/{studentId}")
    public ResponseEntity<?> exportByStudent(@PathVariable String studentId) {
        try {
            byte[] pdfBytes = exportService.exportByStudent(studentId);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "学生作品报告_" + timestamp + ".pdf";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdfBytes.length)
                    .body(pdfBytes);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage() != null ? e.getMessage() : "未知错误"));
        }
    }

    @PostMapping("/export/pdf/classes")
    public ResponseEntity<byte[]> exportByClasses(@RequestBody Map<String, List<String>> request) {
        List<String> classIds = request.get("classIds");
        if (classIds == null || classIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] pdfBytes = exportService.exportByClasses(classIds);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "班级作品报告_" + timestamp + ".pdf";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdfBytes.length)
                    .body(pdfBytes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/export/pdf/students")
    public ResponseEntity<byte[]> exportByStudents(@RequestBody Map<String, List<String>> request) {
        List<String> studentIds = request.get("studentIds");
        if (studentIds == null || studentIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] pdfBytes = exportService.exportByStudents(studentIds);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "学生作品报告_" + timestamp + ".pdf";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdfBytes.length)
                    .body(pdfBytes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/export/pdf/student/{studentId}/selected")
    public ResponseEntity<byte[]> exportStudentSelectedWorks(
            @PathVariable String studentId,
            @RequestBody Map<String, List<String>> request) {
        List<String> taskIds = request.get("taskIds");
        if (taskIds == null || taskIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] pdfBytes = exportService.exportStudentSelectedWorks(studentId, taskIds);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "学生作品报告_" + timestamp + ".pdf";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdfBytes.length)
                    .body(pdfBytes);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}
