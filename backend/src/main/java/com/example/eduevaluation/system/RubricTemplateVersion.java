package com.example.eduevaluation.system;

import java.time.Instant;
import java.util.List;

public record RubricTemplateVersion(
    String id,
    int version,
    String name,
    String description,
    String courseScope,
    TemplateStatus status,
    List<RubricDimension> dimensions,
    Instant createdAt
) {
}

