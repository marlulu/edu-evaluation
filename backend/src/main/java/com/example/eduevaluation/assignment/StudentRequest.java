package com.example.eduevaluation.assignment;

public record StudentRequest(
    String studentNo,
    String name,
    String classId,
    String email,
    String phone,
    StudentStatus status
) {
}

