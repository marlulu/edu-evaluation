package com.example.eduevaluation.assignment;

import java.time.Instant;

public record Student(
    String id,
    String studentNo,
    String name,
    String classId,
    String className,
    String email,
    String phone,
    StudentStatus status,
    Instant createdAt
) {
}

