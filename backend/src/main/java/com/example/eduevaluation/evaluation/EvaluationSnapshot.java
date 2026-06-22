package com.example.eduevaluation.evaluation;

import java.util.List;

public record EvaluationSnapshot(
    List<EvaluationTask> tasks,
    int totalTasks,
    long pendingConfigurationCount,
    long reviewedCount
) {
}
