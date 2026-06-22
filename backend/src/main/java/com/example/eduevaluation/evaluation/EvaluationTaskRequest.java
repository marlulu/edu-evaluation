package com.example.eduevaluation.evaluation;

public record EvaluationTaskRequest(
    String assignmentId,
    String studentId,
    String sourceVersionId,
    String rubricTemplateId,
    String operator
) {
}
