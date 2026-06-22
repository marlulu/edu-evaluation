package com.example.eduevaluation.assignment;

public record AssignmentRequest(
    String title,
    String description,
    String categoryId,
    String classId,
    AssignmentStatus status,
    String dueAt
) {
}

