package com.example.eduevaluation.teaching;

import jakarta.validation.constraints.NotNull;

public record CourseStatusRequest(@NotNull(message = "课程状态不能为空") CourseStatus status) {
}
