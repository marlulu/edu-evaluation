package com.example.eduevaluation.teaching;

import java.time.LocalDateTime;
import java.util.List;

public record CourseResponse(
        String id,
        String name,
        String description,
        String teacherId,
        String teacherName,
        List<String> staffIds,
        List<String> staffNames,
        int studentCount,
        int taskCount,
        CourseStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
