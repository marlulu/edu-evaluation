package com.example.eduevaluation.assignment;

import java.time.Instant;

public record CourseClass(
    String id,
    String name,
    String grade,
    String description,
    int studentCount,
    Instant createdAt
) {
}

