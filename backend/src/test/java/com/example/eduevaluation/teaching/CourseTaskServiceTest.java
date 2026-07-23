package com.example.eduevaluation.teaching;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.common.AiWorkerClient;
import com.example.eduevaluation.common.StorageService;
import com.example.eduevaluation.notification.NotificationService;
import com.example.eduevaluation.work.AnalysisReviewService;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

class CourseTaskServiceTest {

    private final CourseRepository courses = mock(CourseRepository.class);
    private final CourseStaffRepository staff = mock(CourseStaffRepository.class);
    private final CourseMemberRepository members = mock(CourseMemberRepository.class);
    private final CourseTaskRepository tasks = mock(CourseTaskRepository.class);
    private final TaskSubmissionRepository submissions = mock(TaskSubmissionRepository.class);
    private final TaskSubmissionRuleRepository rules = mock(TaskSubmissionRuleRepository.class);
    private final CourseAttachmentRepository courseAttachments = mock(CourseAttachmentRepository.class);
    private final SubmissionCommentRepository comments = mock(SubmissionCommentRepository.class);
    private final ModulePermissionService permissions = mock(ModulePermissionService.class);
    private final AiWorkerClient aiWorkerClient = mock(AiWorkerClient.class);
    private final StorageService storageService = mock(StorageService.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final AnalysisReviewService analysisReviewService = mock(AnalysisReviewService.class);
    private final CourseTaskService service = new CourseTaskService(
            courses, staff, members, tasks, submissions, rules, courseAttachments, comments, permissions, aiWorkerClient,
            storageService, notificationService, analysisReviewService,
            Path.of("target", "test-uploads").toString()
    );
    private final AppPrincipal student = new AppPrincipal("user-1", "student", UserRole.STUDENT, "student-1");

    @Test
    void onlyReturnsTasksFromActiveCoursesThatAreStillOpen() {
        CourseEntity activeCourse = new CourseEntity("course-1", "课程", "描述", "teacher-1", "教师");
        activeCourse.setStatus(CourseStatus.ACTIVE);
        CourseTaskEntity visibleTask = task("task-1", "course-1", LocalDateTime.now().plusDays(1));
        CourseTaskEntity expiredTask = task("task-2", "course-1", LocalDateTime.now().minusMinutes(1));
        when(tasks.findAll()).thenReturn(List.of(visibleTask, expiredTask));
        when(members.existsByCourseIdAndStudentId("course-1", "student-1")).thenReturn(true);
        when(courses.findById("course-1")).thenReturn(Optional.of(activeCourse));
        when(submissions.findTopByTaskIdAndStudentIdOrderBySubmittedAtDesc("task-1", "student-1")).thenReturn(Optional.empty());

        List<CourseTaskService.StudentTaskResponse> visible = service.myTasks(student);

        assertThat(visible).extracting(CourseTaskService.StudentTaskResponse::id).containsExactly("task-1");
    }

    @Test
    void rejectsSubmissionToAnotherCoursesTask() {
        CourseTaskEntity task = task("task-1", "course-1", LocalDateTime.now().plusDays(1));
        when(tasks.findById("task-1")).thenReturn(Optional.of(task));
        when(members.existsByCourseIdAndStudentId("course-1", "student-1")).thenReturn(false);

        assertThatThrownBy(() -> service.submit("task-1",
                new MockMultipartFile("file", "work.pdf", "application/pdf", new byte[] {1}), student))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode().value())
                .isEqualTo(403);
    }

    @Test
    void rejectsSubmissionThatExceedsConfiguredMaximumSize() {
        CourseTaskEntity task = task("task-1", "course-1", LocalDateTime.now().plusDays(1));
        TaskSubmissionRuleEntity rule = new TaskSubmissionRuleEntity("task-1");
        rule.update(".pdf", 1, "仅限 PDF", null);
        when(tasks.findById("task-1")).thenReturn(Optional.of(task));
        when(members.existsByCourseIdAndStudentId("course-1", "student-1")).thenReturn(true);
        when(rules.findById("task-1")).thenReturn(Optional.of(rule));

        assertThatThrownBy(() -> service.submit("task-1",
                new MockMultipartFile("file", "work.pdf", "application/pdf", new byte[] {1, 2}), student))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode().value())
                .isEqualTo(400);
    }

    @Test
    void rejectsSubmissionWithDisallowedExtension() {
        CourseTaskEntity task = task("task-1", "course-1", LocalDateTime.now().plusDays(1));
        TaskSubmissionRuleEntity rule = new TaskSubmissionRuleEntity("task-1");
        rule.update(".pdf", 1024, "仅限 PDF", null);
        when(tasks.findById("task-1")).thenReturn(Optional.of(task));
        when(members.existsByCourseIdAndStudentId("course-1", "student-1")).thenReturn(true);
        when(rules.findById("task-1")).thenReturn(Optional.of(rule));

        assertThatThrownBy(() -> service.submit("task-1",
                new MockMultipartFile("file", "work.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        new byte[] {1}), student))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode().value())
                .isEqualTo(400);
    }

    @Test
    void requiresDeletePermissionToDeleteTask() {
        CourseTaskEntity task = task("task-1", "course-1", LocalDateTime.now().plusDays(1));
        AppPrincipal teacher = new AppPrincipal("teacher-1", "teacher", UserRole.TEACHER, null);
        when(tasks.findById("task-1")).thenReturn(Optional.of(task));
        when(courses.existsById("course-1")).thenReturn(true);
        when(staff.existsByCourseIdAndTeacherId("course-1", "teacher-1")).thenReturn(true);

        service.deleteTask("task-1", teacher);

        verify(permissions).require(teacher, ModulePermissionService.TASK, ModuleAction.DELETE);
    }

    @Test
    void importsPdfRuleTextAndRecordsTheSourceFile() {
        CourseTaskEntity task = task("task-1", "course-1", LocalDateTime.now().plusDays(1));
        AppPrincipal teacher = new AppPrincipal("teacher-1", "teacher", UserRole.TEACHER, null);
        MockMultipartFile file = new MockMultipartFile("file", "rule.pdf", "application/pdf", new byte[] {1});
        TaskSubmissionRuleEntity existingRule = new TaskSubmissionRuleEntity("task-1");
        when(tasks.findById("task-1")).thenReturn(Optional.of(task));
        when(courses.existsById("course-1")).thenReturn(true);
        when(staff.existsByCourseIdAndTeacherId("course-1", "teacher-1")).thenReturn(true);
        when(rules.findById("task-1")).thenReturn(Optional.of(existingRule));
        when(aiWorkerClient.validateDocument(file)).thenReturn(Map.of("text", "提交 PDF，大小不超过 10 MB。"));

        CourseTaskService.TaskRuleResponse response = service.importSubmissionRule("task-1", file, teacher);

        assertThat(response.ruleText()).isEqualTo("提交 PDF，大小不超过 10 MB。");
        assertThat(response.importedFileName()).isEqualTo("rule.pdf");
        verify(rules).save(org.mockito.ArgumentMatchers.any(TaskSubmissionRuleEntity.class));
    }

    private CourseTaskEntity task(String id, String courseId, LocalDateTime deadline) {
        CourseTaskEntity task = new CourseTaskEntity(id, courseId, "任务", "描述", deadline);
        task.update("任务", "描述", deadline, TaskStatus.ACTIVE);
        return task;
    }
}
