package com.example.eduevaluation.result;

import java.util.List;

public record ResultSnapshot(
    List<ResultReport> reports,
    List<ClassDimensionAverage> classAverages,
    List<ComparisonRow> studentHistory,
    List<ComparisonRow> classComparison
) {
}

