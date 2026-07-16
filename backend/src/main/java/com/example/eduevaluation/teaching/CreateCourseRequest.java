package com.example.eduevaluation.teaching;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateCourseRequest(
        @NotBlank(message = "课程名称不能为空")
        @Size(max = 100, message = "课程名称不能超过100个字符")
        String name,
        @NotBlank(message = "课程描述不能为空")
        @Size(max = 500, message = "课程描述不能超过500个字符")
        String description,
        List<String> staffIds,
        List<String> groupIds,
        List<String> studentIds
) {
}
