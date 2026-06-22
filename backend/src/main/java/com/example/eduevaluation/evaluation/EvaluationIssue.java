package com.example.eduevaluation.evaluation;

public record EvaluationIssue(
    String id,
    String category,
    String severity,
    String title,
    String description,
    String locationHint
) {
}
