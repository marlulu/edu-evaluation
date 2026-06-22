package com.example.eduevaluation.evaluation;

import java.time.Instant;
import java.util.List;

public record EvaluationTask(
    String id,
    String assignmentId,
    String assignmentTitle,
    String classId,
    String className,
    String studentId,
    String studentName,
    String sourceVersionId,
    int sourceVersionNumber,
    String rubricTemplateId,
    String rubricTemplateName,
    int rubricVersion,
    EvaluationTaskStatus status,
    int autoScore,
    Integer finalScore,
    String summary,
    List<EvaluationDimensionScore> dimensionScores,
    List<EvaluationIssue> issues,
    List<EvaluationSuggestion> suggestions,
    List<EvaluationReviewRecord> reviewRecords,
    Instant createdAt,
    Instant updatedAt
) {
}
