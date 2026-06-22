package com.example.eduevaluation.result;

public record ComparisonRow(
    String label,
    int overallScore,
    int versionNumber,
    String className,
    String studentName
) {
}

