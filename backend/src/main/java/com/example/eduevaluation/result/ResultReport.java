package com.example.eduevaluation.result;

import java.time.Instant;
import java.util.List;

public record ResultReport(
    String id,
    String assignmentId,
    String assignmentTitle,
    String classId,
    String className,
    String studentId,
    String studentName,
    String sourceVersionId,
    int sourceVersionNumber,
    int overallScore,
    List<DimensionScore> dimensions,
    List<String> strengths,
    List<String> weaknesses,
    List<String> suggestions,
    String evaluator,
    String teacherSummary,
    Instant releasedAt,
    List<FeedbackLoopEntry> feedbackTrail
) {
}

