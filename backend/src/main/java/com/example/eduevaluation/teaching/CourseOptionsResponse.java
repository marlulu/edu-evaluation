package com.example.eduevaluation.teaching;

import java.util.List;
import com.example.eduevaluation.auth.ModulePermissionService;

public record CourseOptionsResponse(
        List<CourseGroupOption> groups,
        List<CourseStudentOption> students,
        List<ModulePermissionService.TeachingStaffOption> teachers
) {
}
