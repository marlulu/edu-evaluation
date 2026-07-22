package com.example.eduevaluation.teaching;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.studentmanagement.StudentManagementService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class CourseServiceTest {

    private final CourseRepository courses = mock(CourseRepository.class);
    private final CourseMemberRepository members = mock(CourseMemberRepository.class);
    private final CourseStaffRepository staff = mock(CourseStaffRepository.class);
    private final StudentManagementService students = mock(StudentManagementService.class);
    private final ModulePermissionService permissions = mock(ModulePermissionService.class);
    private final CourseAttachmentRepository attachments = mock(CourseAttachmentRepository.class);
    private final CourseService service = new CourseService(
            courses, members, staff, students, permissions, attachments, "data/uploads");
    private final AppPrincipal teacher = new AppPrincipal("teacher-1", "teacher", UserRole.TEACHER, null);

    @Test
    void createsCourseWithGroupAndIndividualStudentSnapshot() {
        when(courses.save(any(CourseEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(students.studentIdsForGroups(List.of("group-1"))).thenReturn(List.of("student-1", "student-2"));
        when(students.allExist(any())).thenReturn(true);
        when(permissions.requireTeachingStaff(List.of("teacher-1"))).thenReturn(Map.of("teacher-1", "课程教师"));

        service.create(new CreateCourseRequest(
                "人工智能概论", "课程说明", List.of(), List.of("group-1"), List.of("student-3")), teacher);

        verify(permissions).require(teacher, ModulePermissionService.COURSE, ModuleAction.CREATE);
        ArgumentCaptor<CourseMemberEntity> memberCaptor = ArgumentCaptor.forClass(CourseMemberEntity.class);
        verify(members, org.mockito.Mockito.times(3)).save(memberCaptor.capture());
        assertThat(memberCaptor.getAllValues())
                .extracting(member -> (String) ReflectionTestUtils.getField(member, "studentId"))
                .containsExactlyInAnyOrder("student-1", "student-2", "student-3");
    }

    @Test
    void addsOnlyStudentsNotAlreadyInCourseWhenAddingMultipleGroups() {
        CourseEntity course = new CourseEntity("course-1", "Course", "Description", "teacher-1", "Teacher");
        when(courses.findById("course-1")).thenReturn(Optional.of(course));
        when(students.studentIdsForGroups(List.of("group-1", "group-2")))
                .thenReturn(List.of("student-1", "student-2", "student-3"));
        CourseMemberEntity existingMember = new CourseMemberEntity("member-1", "course-1", "student-1");
        when(members.findByCourseId("course-1")).thenReturn(List.of(existingMember));
        when(students.courseStudents()).thenReturn(List.of(
                new StudentManagementService.CourseStudentOption("student-1", "001", "Student 1"),
                new StudentManagementService.CourseStudentOption("student-2", "002", "Student 2"),
                new StudentManagementService.CourseStudentOption("student-3", "003", "Student 3")
        ));

        List<CourseStudentOption> added = service.addStudentGroups(
                "course-1",
                new CourseStudentGroupRequest(List.of("group-1", "group-2")),
                teacher
        );

        verify(permissions).require(teacher, ModulePermissionService.COURSE, ModuleAction.EDIT);
        ArgumentCaptor<CourseMemberEntity> memberCaptor = ArgumentCaptor.forClass(CourseMemberEntity.class);
        verify(members, org.mockito.Mockito.times(2)).save(memberCaptor.capture());
        assertThat(memberCaptor.getAllValues())
                .extracting(member -> (String) ReflectionTestUtils.getField(member, "studentId"))
                .containsExactlyInAnyOrder("student-2", "student-3");
        assertThat(added).extracting(CourseStudentOption::id)
                .containsExactlyInAnyOrder("student-2", "student-3");
    }
}
