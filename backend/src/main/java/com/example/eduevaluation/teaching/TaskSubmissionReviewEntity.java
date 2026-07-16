package com.example.eduevaluation.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "task_submission_reviews")
class TaskSubmissionReviewEntity {
    @Id private String id;
    @Column(name = "submission_id", nullable = false) private String submissionId;
    private BigDecimal score;
    @Column(columnDefinition = "TEXT") private String feedback;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private TaskReviewStatus status;
    @Column(name = "ai_task_id") private String aiTaskId;
    @Column(name = "reviewer_id") private String reviewerId;
    @Column(name = "reviewed_at") private LocalDateTime reviewedAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    protected TaskSubmissionReviewEntity() {}

    TaskSubmissionReviewEntity(String id, String submissionId, String aiTaskId, String reviewerId) {
        this.id = id;
        this.submissionId = submissionId;
        this.aiTaskId = aiTaskId;
        this.reviewerId = reviewerId;
        this.status = TaskReviewStatus.DRAFT;
    }

    @PrePersist void created() { updatedAt = LocalDateTime.now(); }
    @PreUpdate void updated() { updatedAt = LocalDateTime.now(); }

    String getSubmissionId() { return submissionId; }
    BigDecimal getScore() { return score; }
    String getFeedback() { return feedback; }
    TaskReviewStatus getStatus() { return status; }
    String getAiTaskId() { return aiTaskId; }
    String getReviewerId() { return reviewerId; }
    LocalDateTime getReviewedAt() { return reviewedAt; }

    void update(BigDecimal score, String feedback, TaskReviewStatus status, String reviewerId) {
        this.score = score;
        this.feedback = feedback;
        this.status = status;
        this.reviewerId = reviewerId;
        this.reviewedAt = LocalDateTime.now();
    }
}
