package com.example.eduevaluation.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ModulePermissionServiceTest {

    private final ModulePermissionRepository permissions = mock(ModulePermissionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ModulePermissionService service = new ModulePermissionService(permissions, users);

    @Test
    void acceptsTeachersAndAssistantsAsCourseStaff() {
        AppUser teacher = new AppUser("teacher-1", "teacher", "hash", "课程教师", UserRole.TEACHER);
        AppUser assistant = new AppUser("assistant-1", "assistant", "hash", "教学助理", UserRole.ASSISTANT);
        when(users.findById("teacher-1")).thenReturn(java.util.Optional.of(teacher));
        when(users.findById("assistant-1")).thenReturn(java.util.Optional.of(assistant));

        Map<String, String> staff = service.requireTeachingStaff(List.of("teacher-1", "assistant-1", "teacher-1"));

        assertThat(staff).containsExactlyInAnyOrderEntriesOf(Map.of(
                "teacher-1", "课程教师",
                "assistant-1", "教学助理"
        ));
    }

    @Test
    void rejectsStudentAsCourseStaff() {
        AppUser student = new AppUser("student-1", "student", "hash", "学生", UserRole.STUDENT);
        when(users.findById("student-1")).thenReturn(java.util.Optional.of(student));

        assertThatThrownBy(() -> service.requireTeachingStaff(List.of("student-1")))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode().value())
                .isEqualTo(400);
    }
}
