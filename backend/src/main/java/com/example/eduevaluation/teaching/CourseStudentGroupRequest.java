package com.example.eduevaluation.teaching;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record CourseStudentGroupRequest(@NotEmpty List<String> groupIds) {
}
