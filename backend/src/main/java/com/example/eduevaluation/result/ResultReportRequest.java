package com.example.eduevaluation.result;

import java.util.List;

public record ResultReportRequest(
    String assignmentId,
    String studentId,
    String sourceVersionId,
    List<DimensionScore> dimensions,
    List<String> strengths,
    List<String> weaknesses,
    List<String> suggestions,
    String evaluator,
    String teacherSummary
) {
}

