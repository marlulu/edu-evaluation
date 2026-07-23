package com.example.eduevaluation.work;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.common.AiWorkerClient;
import com.example.eduevaluation.common.StorageService;
import com.example.eduevaluation.teaching.CourseTaskService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.io.IOException;
import java.io.InputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.io.ByteArrayOutputStream;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/analysis")
public class AnalysisReviewController {
    private final AiWorkerClient aiWorkerClient;
    private final AnalysisReviewService analysisReviewService;
    private final AnalysisReviewRepository reviewRepository;
    private final CourseTaskService courseTaskService;
    private final StorageService storageService;
    private final ObjectMapper objectMapper;

    public AnalysisReviewController(AiWorkerClient aiWorkerClient,
            AnalysisReviewService analysisReviewService, AnalysisReviewRepository reviewRepository,
            CourseTaskService courseTaskService, StorageService storageService, ObjectMapper objectMapper) {
        this.aiWorkerClient = aiWorkerClient;
        this.analysisReviewService = analysisReviewService;
        this.reviewRepository = reviewRepository;
        this.courseTaskService = courseTaskService;
        this.storageService = storageService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/tasks")
    public Map<String, Object> listTasks(@AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        List<Map<String, Object>> tasks = courseTaskService.listAnalysisTasks();
        return Map.of("tasks", tasks);
    }

    @GetMapping("/jobs/{jobId}")
    public Map<String, Object> job(@PathVariable String jobId, @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        courseTaskService.requireAnalysisJobAccess(jobId, principal);
        Map<String, Object> analysis = aiWorkerClient.analysisJob(jobId);
        analysis.put("review", analysisReviewService.synchronize(jobId, null, analysis));
        return analysis;
    }

    @DeleteMapping("/jobs/{jobId}")
    public Map<String, Object> cancel(@PathVariable String jobId, @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        courseTaskService.requireAnalysisJobAccess(jobId, principal);
        return aiWorkerClient.cancelAnalysisJob(jobId);
    }

    @GetMapping("/jobs/{jobId}/artifacts")
    public Map<String, String> artifact(@PathVariable String jobId, @RequestParam String objectKey,
            @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        courseTaskService.requireAnalysisJobAccess(jobId, principal);
        Map<String, Object> analysis = aiWorkerClient.analysisJob(jobId);
        if (!containsArtifact(analysis.get("result"), objectKey)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到该分析图片证据");
        }
        return Map.of("url", storageService.getFileUrl(objectKey));
    }

    @GetMapping("/jobs/{jobId}/artifacts/content")
    public ResponseEntity<byte[]> artifactContent(@PathVariable String jobId, @RequestParam String objectKey,
            @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        courseTaskService.requireAnalysisJobAccess(jobId, principal);
        Map<String, Object> analysis = aiWorkerClient.analysisJob(jobId);
        if (!containsArtifact(analysis.get("result"), objectKey)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到该分析图片证据");
        }
        try (InputStream input = storageService.openFile(objectKey)) {
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .body(input.readAllBytes());
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "读取分析图片证据失败", exception);
        }
    }

    @GetMapping("/jobs/{jobId}/review")
    public Map<String, Object> review(@PathVariable String jobId, @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        courseTaskService.requireAnalysisJobAccess(jobId, principal);
        Map<String, Object> review = analysisReviewService.get(jobId);
        if (review == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "尚未生成可审核的分析报告");
        }
        return review;
    }

    @PutMapping("/jobs/{jobId}/review")
    public Map<String, Object> revise(@PathVariable String jobId, @RequestBody AnalysisReviewUpdateRequest request,
            @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        courseTaskService.requireAnalysisJobAccess(jobId, principal);
        return analysisReviewService.revise(jobId, request, principal.userId());
    }

    @PostMapping("/jobs/{jobId}/review/publish")
    public Map<String, Object> publish(@PathVariable String jobId, @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        courseTaskService.requireAnalysisJobAccess(jobId, principal);
        return analysisReviewService.publish(jobId, principal.userId());
    }

    @GetMapping("/students/{studentId}/jobs")
    public List<Map<String, Object>> studentJobs(@PathVariable String studentId, @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        List<AnalysisReviewEntity> reviews = reviewRepository.findByStudentIdOrderByUpdatedAtDesc(studentId);
        return reviews.stream().map(review -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("jobId", review.getJobId());
            item.put("submittedAt", review.getUpdatedAt());
            item.put("fileName", review.getJobId());
            try {
                Map<String, Object> analysis = aiWorkerClient.analysisJob(review.getJobId());
                item.put("analysis", analysis);
                item.put("review", analysisReviewService.synchronize(review.getJobId(), studentId, analysis));
            } catch (Exception exception) {
                item.put("analysis", Map.of("status", "unavailable", "error", "Analysis worker is unavailable"));
                Map<String, Object> cachedReview = analysisReviewService.get(review.getJobId());
                if (cachedReview != null) {
                    item.put("review", cachedReview);
                }
            }
            return item;
        }).toList();
    }

    @PostMapping("/jobs/export")
    public ResponseEntity<byte[]> exportJobs(@RequestBody Map<String, List<String>> request,
            @AuthenticationPrincipal AppPrincipal principal) {
        requireTeachingStaff(principal);
        List<String> jobIds = request.get("jobIds");
        if (jobIds == null || jobIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (ZipOutputStream zos = new ZipOutputStream(baos)) {
                for (String jobId : jobIds) {
                    courseTaskService.requireAnalysisJobAccess(jobId, principal);
                    Map<String, Object> analysis = aiWorkerClient.analysisJob(jobId);
                    analysis.put("review", analysisReviewService.synchronize(jobId, null, analysis));
                    String fileName = jobId + ".json";
                    zos.putNextEntry(new ZipEntry(fileName));
                    zos.write(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(analysis));
                    zos.closeEntry();
                }
            }
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String zipName = "分析报告_" + timestamp + ".zip";
            String encoded = URLEncoder.encode(zipName, StandardCharsets.UTF_8).replace("+", "%20");
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .body(baos.toByteArray());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    private void requireTeachingStaff(AppPrincipal principal) {
        if (principal == null || (principal.role() != UserRole.ADMIN && principal.role() != UserRole.TEACHER && principal.role() != UserRole.ASSISTANT)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only teaching staff may review analysis results");
        }
    }

    @SuppressWarnings("unchecked")
    private boolean containsArtifact(Object result, String objectKey) {
        if (!(result instanceof Map<?, ?> resultMap) || !(resultMap.get("evidence") instanceof List<?> evidence)) {
            return false;
        }
        return evidence.stream().anyMatch(item -> {
            if (!(item instanceof Map<?, ?> evidenceItem) || !(evidenceItem.get("metadata") instanceof Map<?, ?> metadata)) {
                return false;
            }
            return objectKey.equals(metadata.get("artifactObjectKey"));
        });
    }
}
