package com.example.eduevaluation.teaching;

import java.util.List;

public record CourseOptionsResponse(List<CourseGroupOption> groups, List<CourseStudentOption> students) {
}
