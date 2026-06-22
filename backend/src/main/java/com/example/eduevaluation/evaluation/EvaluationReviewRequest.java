package com.example.eduevaluation.evaluation;

public record EvaluationReviewRequest(
    String reviewerId,
    String reviewerName,
    Integer revisedScore,
    String reason
) {
}
