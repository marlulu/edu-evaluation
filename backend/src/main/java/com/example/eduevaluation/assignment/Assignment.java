package com.example.eduevaluation.assignment;

import java.time.Instant;
import java.util.List;

public record Assignment(
    String id,
    String title,
    String description,
    String categoryId,
    String categoryName,
    String classId,
    String className,
    AssignmentStatus status,
    String dueAt,
    int currentVersion,
    List<AssignmentVersion> versions,
    Instant createdAt,
    Instant updatedAt
) {
}

