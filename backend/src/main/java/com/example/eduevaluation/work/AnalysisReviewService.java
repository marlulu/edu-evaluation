package com.example.eduevaluation.work;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AnalysisReviewService {
    private final AnalysisReviewRepository repository;
    private final ObjectMapper objectMapper;

    public AnalysisReviewService(AnalysisReviewRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> synchronize(String jobId, String studentId, Map<String, Object> analysis) {
        AnalysisReviewEntity review = repository.findByJobId(jobId)
                .orElseGet(() -> new AnalysisReviewEntity(UUID.randomUUID().toString(), jobId, studentId));
        if (review.getStudentId() == null && studentId != null) {
            review.setStudentId(studentId);
        }
        Object report = analysis.get("assessment_report");
        if (report != null) {
            try {
                review.setAiReportJson(objectMapper.writeValueAsString(report));
            } catch (JsonProcessingException exception) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "分析报告格式无效", exception);
            }
        }
        review.setUpdatedAt(LocalDateTime.now());
        return toResponse(repository.save(review));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(String jobId) {
        return repository.findByJobId(jobId).map(this::toResponse).orElse(null);
    }

    @Transactional
    public Map<String, Object> revise(String jobId, AnalysisReviewUpdateRequest request, String reviewerId) {
        AnalysisReviewEntity review = repository.findByJobId(jobId)
                .orElseGet(() -> new AnalysisReviewEntity(UUID.randomUUID().toString(), jobId, null));
        review.setReviewRuleScore(request.ruleScore());
        review.setReviewQualityScore(request.qualityReferenceScore());
        review.setReviewComment(trimToNull(request.comment()));
        review.setReviewerId(reviewerId);
        review.setReviewedAt(LocalDateTime.now());
        review.setUpdatedAt(LocalDateTime.now());
        if (!AnalysisReviewStatus.PUBLISHED.name().equals(review.getStatus())) {
            review.setStatus(AnalysisReviewStatus.REVISED.name());
        }
        return toResponse(repository.save(review));
    }

    @Transactional
    public Map<String, Object> publish(String jobId, String reviewerId) {
        AnalysisReviewEntity review = repository.findByJobId(jobId)
                .orElseGet(() -> new AnalysisReviewEntity(UUID.randomUUID().toString(), jobId, null));
        review.setStatus(AnalysisReviewStatus.PUBLISHED.name());
        review.setReviewerId(reviewerId);
        review.setPublishedAt(LocalDateTime.now());
        review.setUpdatedAt(LocalDateTime.now());
        return toResponse(repository.save(review));
    }

    private Map<String, Object> toResponse(AnalysisReviewEntity review) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", review.getId());
        response.put("jobId", review.getJobId());
        response.put("studentId", review.getStudentId());
        response.put("status", review.getStatus());
        response.put("ruleScore", review.getReviewRuleScore());
        response.put("qualityReferenceScore", review.getReviewQualityScore());
        response.put("comment", review.getReviewComment());
        response.put("reviewerId", review.getReviewerId());
        response.put("reviewedAt", review.getReviewedAt());
        response.put("publishedAt", review.getPublishedAt());
        response.put("updatedAt", review.getUpdatedAt());
        if (review.getAiReportJson() != null) {
            try {
                response.put("aiReport", objectMapper.readValue(review.getAiReportJson(), Object.class));
            } catch (JsonProcessingException exception) {
                response.put("aiReport", null);
            }
        }
        return response;
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
