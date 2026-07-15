package com.example.eduevaluation.classroom;

import java.time.LocalDateTime;

public record ClassSummary(
        String classId,
        String className,
        String description,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        long studentCount
) {
}
