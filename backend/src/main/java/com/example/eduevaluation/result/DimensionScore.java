package com.example.eduevaluation.result;

public record DimensionScore(
    String name,
    int score,
    int maxScore,
    String comment
) {
}

