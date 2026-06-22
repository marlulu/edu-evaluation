package com.example.eduevaluation.system;

import java.time.Instant;
import java.util.List;

public record RubricTemplate(
    String id,
    String name,
    String description,
    String courseScope,
    TemplateStatus status,
    int currentVersion,
    List<RubricDimension> dimensions,
    List<RubricTemplateVersion> history,
    Instant createdAt,
    Instant updatedAt
) {
}

