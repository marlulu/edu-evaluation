package com.example.eduevaluation.work;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "analysis_reviews")
public class AnalysisReviewEntity {
    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "job_id", nullable = false, unique = true, length = 100)
    private String jobId;

    @Column(name = "student_id", length = 36)
    private String studentId;

    @Column(name = "ai_report_json", columnDefinition = "JSON")
    private String aiReportJson;

    @Column(nullable = false, length = 24)
    private String status;

    @Column(name = "review_rule_score")
    private BigDecimal reviewRuleScore;

    @Column(name = "review_quality_score")
    private BigDecimal reviewQualityScore;

    @Column(name = "review_comment", columnDefinition = "TEXT")
    private String reviewComment;

    @Column(name = "reviewer_id", length = 36)
    private String reviewerId;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected AnalysisReviewEntity() {
    }

    public AnalysisReviewEntity(String id, String jobId, String studentId) {
        this.id = id;
        this.jobId = jobId;
        this.studentId = studentId;
        this.status = AnalysisReviewStatus.PENDING_REVIEW.name();
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public String getJobId() { return jobId; }
    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }
    public String getAiReportJson() { return aiReportJson; }
    public void setAiReportJson(String aiReportJson) { this.aiReportJson = aiReportJson; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Double getReviewRuleScore() { return reviewRuleScore == null ? null : reviewRuleScore.doubleValue(); }
    public void setReviewRuleScore(Double reviewRuleScore) {
        this.reviewRuleScore = reviewRuleScore == null ? null : BigDecimal.valueOf(reviewRuleScore);
    }
    public Double getReviewQualityScore() { return reviewQualityScore == null ? null : reviewQualityScore.doubleValue(); }
    public void setReviewQualityScore(Double reviewQualityScore) {
        this.reviewQualityScore = reviewQualityScore == null ? null : BigDecimal.valueOf(reviewQualityScore);
    }
    public String getReviewComment() { return reviewComment; }
    public void setReviewComment(String reviewComment) { this.reviewComment = reviewComment; }
    public String getReviewerId() { return reviewerId; }
    public void setReviewerId(String reviewerId) { this.reviewerId = reviewerId; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public LocalDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
