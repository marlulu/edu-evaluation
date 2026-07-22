package com.example.eduevaluation.work;

public record AnalysisReviewUpdateRequest(
        Double ruleScore,
        Double qualityReferenceScore,
        String comment) {
}
