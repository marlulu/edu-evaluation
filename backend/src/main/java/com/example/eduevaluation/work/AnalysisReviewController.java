package com.example.eduevaluation.work;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.common.AiWorkerClient;
import com.example.eduevaluation.classroom.ClassService;
import com.example.eduevaluation.common.StorageService;
import com.example.eduevaluation.teaching.CourseTaskService;
import java.util.Map;
import java.util.List;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

@RestController
@RequestMapping("/api/analysis")
public class AnalysisReviewController {
    private final AiWorkerClient aiWorkerClient;
    private final ClassService classService;
    private final AnalysisReviewService analysisReviewService;
    private final CourseTaskService courseTaskService;
    private final StorageService storageService;

    public AnalysisReviewController(AiWorkerClient aiWorkerClient, ClassService classService,
            AnalysisReviewService analysisReviewService, CourseTaskService courseTaskService,
            StorageService storageService) {
        this.aiWorkerClient = aiWorkerClient;
        this.classService = classService;
        this.analysisReviewService = analysisReviewService;
        this.courseTaskService = courseTaskService;
        this.storageService = storageService;
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
        return classService.getStudentWorks(studentId).stream().map(work -> {
            Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("jobId", work.getTaskId());
            item.put("submittedAt", work.getCreatedAt());
            item.put("fileName", work.getWorkTask() == null ? work.getTaskId() : work.getWorkTask().getFileName());
            try {
                Map<String, Object> analysis = aiWorkerClient.analysisJob(work.getTaskId());
                item.put("analysis", analysis);
                item.put("review", analysisReviewService.synchronize(work.getTaskId(), studentId, analysis));
            } catch (Exception exception) {
                item.put("analysis", Map.of("status", "unavailable", "error", "Analysis worker is unavailable"));
                Map<String, Object> review = analysisReviewService.get(work.getTaskId());
                if (review != null) {
                    item.put("review", review);
                }
            }
            return item;
        }).toList();
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
