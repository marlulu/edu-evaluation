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
            byte[] zipBytes = exportService.exportToPdf(taskIds);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "作品导出_" + timestamp + ".zip";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .contentLength(zipBytes.length)
                    .body(zipBytes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/export/pdf/class/{classId}")
    public ResponseEntity<byte[]> exportByClass(@PathVariable String classId) {
        try {
            byte[] zipBytes = exportService.exportByClass(classId);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "班级作品导出_" + timestamp + ".zip";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .contentLength(zipBytes.length)
                    .body(zipBytes);
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
            byte[] zipBytes = exportService.exportByStudent(studentId);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "学生作品导出_" + timestamp + ".zip";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .contentLength(zipBytes.length)
                    .body(zipBytes);
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
            byte[] zipBytes = exportService.exportByClasses(classIds);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "班级作品导出_" + timestamp + ".zip";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .contentLength(zipBytes.length)
                    .body(zipBytes);
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
            byte[] zipBytes = exportService.exportByStudents(studentIds);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "学生作品导出_" + timestamp + ".zip";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .contentLength(zipBytes.length)
                    .body(zipBytes);
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
            byte[] zipBytes = exportService.exportStudentSelectedWorks(studentId, taskIds);

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "学生作品导出_" + timestamp + ".zip";
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .contentLength(zipBytes.length)
                    .body(zipBytes);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}
