package com.example.eduevaluation.evaluation;

public record EvaluationDimensionScore(
    String dimensionName,
    int weight,
    int maxScore,
    int score,
    String basis
) {
}
