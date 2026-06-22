package com.example.eduevaluation.evaluation;

import java.time.Instant;

public record EvaluationReviewRecord(
    String id,
    String reviewerId,
    String reviewerName,
    int originalScore,
    int revisedScore,
    String reason,
    Instant reviewedAt
) {
}
