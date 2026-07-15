package com.example.eduevaluation.teaching;

import java.time.LocalDateTime;

public record CourseResponse(
        String id,
        String name,
        String description,
        String teacherId,
        String teacherName,
        int studentCount,
        int taskCount,
        CourseStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
