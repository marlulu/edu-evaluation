package com.example.eduevaluation.system;

import java.util.List;

public record RubricTemplateRequest(
    String name,
    String description,
    String courseScope,
    TemplateStatus status,
    List<RubricDimension> dimensions
) {
}

