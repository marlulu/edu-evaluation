package com.example.eduevaluation.teaching;

import jakarta.validation.constraints.NotBlank;

public record CourseStudentRequest(@NotBlank String studentId) {
}
