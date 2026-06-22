package com.example.eduevaluation.result;

public record ClassDimensionAverage(
    String classId,
    String className,
    String dimension,
    double averageScore
) {
}

