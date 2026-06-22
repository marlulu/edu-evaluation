package com.example.eduevaluation.assignment;

import java.time.Instant;

public record AssignmentVersion(
    String id,
    String assignmentId,
    int version,
    String studentId,
    String studentName,
    String fileName,
    String contentType,
    long size,
    String storagePath,
    String note,
    AssignmentStatus status,
    Instant submittedAt
) {
}

