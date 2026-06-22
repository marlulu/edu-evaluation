package com.example.eduevaluation.result;

import java.time.Instant;

public record FeedbackLoopEntry(
    String id,
    FeedbackActionType actionType,
    String actor,
    String comment,
    String sourceVersionId,
    String targetVersionId,
    Instant createdAt
) {
}

