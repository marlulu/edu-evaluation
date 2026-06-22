package com.example.eduevaluation.assignment;

import java.time.Instant;

public record AssignmentCategory(
    String id,
    String name,
    String description,
    Instant createdAt
) {
}

