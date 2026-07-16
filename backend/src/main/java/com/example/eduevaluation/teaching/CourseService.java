package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.studentmanagement.StudentManagementService;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CourseService {

    private static final String DEMO_TEACHER_ID = "current-teacher";
    private static final String DEMO_TEACHER_NAME = "当前教师";

    private final CourseRepository courseRepository;
    private final CourseMemberRepository courseMemberRepository;
    private final CourseStaffRepository courseStaffRepository;
    private final StudentManagementService studentManagementService;
    private final ModulePermissionService permissions;

    public CourseService(
            CourseRepository courseRepository,
            CourseMemberRepository courseMemberRepository,
            CourseStaffRepository courseStaffRepository,
            StudentManagementService studentManagementService,
            ModulePermissionService permissions
    ) {
        this.courseRepository = courseRepository;
        this.courseMemberRepository = courseMemberRepository;
        this.courseStaffRepository = courseStaffRepository;
        this.studentManagementService = studentManagementService;
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public List<CourseResponse> list(CourseStatus status, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.COURSE, ModuleAction.VIEW);
        List<CourseEntity> courses = status == null
                ? courseRepository.findAllByOrderByUpdatedAtDesc()
                : courseRepository.findByStatusOrderByUpdatedAtDesc(status);
        return courses.stream().filter(course -> canAccessCourse(course, principal)).map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CourseResponse get(String courseId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.COURSE, ModuleAction.VIEW);
        CourseEntity course = requireCourse(courseId);
        requireCourseAccess(course, principal);
        return toResponse(course);
    }

    @Transactional(readOnly = true)
    public CourseOptionsResponse options(AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.COURSE, ModuleAction.VIEW);
        List<CourseGroupOption> groups = studentManagementService.courseGroups().stream()
                .map(group -> new CourseGroupOption(group.id(), group.name(), group.studentCount()))
                .toList();
        List<CourseStudentOption> students = studentManagementService.courseStudents().stream()
                .map(student -> new CourseStudentOption(student.id(), student.studentNumber(), student.name()))
                .toList();
        return new CourseOptionsResponse(groups, students, permissions.listTeachingStaff(principal));
    }

    @Transactional(readOnly = true)
    public List<CourseStudentOption> students(String courseId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.COURSE, ModuleAction.VIEW);
        CourseEntity course = requireCourse(courseId);
        requireCourseAccess(course, principal);
        Set<String> memberIds = courseMemberRepository.findByCourseId(courseId).stream()
                .map(CourseMemberEntity::getStudentId).collect(java.util.stream.Collectors.toSet());
        return studentManagementService.courseStudents().stream()
                .filter(student -> memberIds.contains(student.id()))
                .map(student -> new CourseStudentOption(student.id(), student.studentNumber(), student.name()))
                .toList();
    }

    @Transactional
    public CourseResponse create(CreateCourseRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.COURSE, ModuleAction.CREATE);
        CourseEntity course = new CourseEntity(
                UUID.randomUUID().toString(),
                request.name().trim(),
                request.description().trim(),
                principal.userId(),
                principal.username()
        );
        CourseEntity savedCourse = courseRepository.save(course);
        replaceStaff(savedCourse.getId(), request.staffIds(), principal);
        replaceMembers(savedCourse.getId(), request.groupIds(), request.studentIds());
        return toResponse(savedCourse);
    }

    @Transactional
    public CourseResponse update(String courseId, UpdateCourseRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.COURSE, ModuleAction.EDIT);
        CourseEntity course = requireCourse(courseId);
        requireCourseAccess(course, principal);
        if (course.getStatus() == CourseStatus.ARCHIVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已归档课程不能编辑");
        }
        course.setName(request.name().trim());
        course.setDescription(request.description().trim());
        CourseEntity savedCourse = courseRepository.save(course);
        if (request.staffIds() != null) {
            replaceStaff(courseId, request.staffIds(), principal);
        }
        if (request.groupIds() != null || request.studentIds() != null) {
            replaceMembers(savedCourse.getId(), request.groupIds(), request.studentIds());
        }
        return toResponse(savedCourse);
    }

    @Transactional
    public CourseResponse updateStatus(String courseId, CourseStatus targetStatus, AppPrincipal principal) {
        CourseEntity course = requireCourse(courseId);
        permissions.require(principal, ModulePermissionService.COURSE, ModuleAction.EDIT);
        requireCourseAccess(course, principal);
        if (!isValidTransition(course.getStatus(), targetStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "课程状态不能这样流转");
        }
        course.setStatus(targetStatus);
        return toResponse(courseRepository.save(course));
    }

    @Transactional
    public void delete(String courseId, AppPrincipal principal) {
        CourseEntity course = requireCourse(courseId);
        permissions.require(principal, ModulePermissionService.COURSE, ModuleAction.DELETE);
        requireCourseOwner(course, principal);
        courseMemberRepository.deleteByCourseId(courseId);
        courseStaffRepository.deleteByCourseId(courseId);
        courseRepository.delete(course);
    }

    private CourseEntity requireCourse(String courseId) {
        return courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "课程不存在"));
    }

    private void requireTeachingRole(AppPrincipal principal) {
        if (principal.role() != UserRole.ADMIN && principal.role() != UserRole.TEACHER && principal.role() != UserRole.ASSISTANT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前角色无权访问课程管理");
        }
    }

    private void requireCourseOwner(CourseEntity course, AppPrincipal principal) {
        requireTeachingRole(principal);
        if (principal.role() != UserRole.ADMIN && !course.getTeacherId().equals(principal.userId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您不是该课程的任教教师");
        }
    }

    private boolean isValidTransition(CourseStatus currentStatus, CourseStatus targetStatus) {
        return (currentStatus == CourseStatus.DRAFT && targetStatus == CourseStatus.ACTIVE)
                || (currentStatus == CourseStatus.ACTIVE && targetStatus == CourseStatus.CLOSED)
                || (currentStatus == CourseStatus.CLOSED && targetStatus == CourseStatus.ARCHIVED);
    }

    private boolean canAccessCourse(CourseEntity course, AppPrincipal principal) {
        return principal.role() == UserRole.ADMIN
                || course.getTeacherId().equals(principal.userId())
                || courseStaffRepository.existsByCourseIdAndTeacherId(course.getId(), principal.userId());
    }

    private void requireCourseAccess(CourseEntity course, AppPrincipal principal) {
        if (!canAccessCourse(course, principal)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "您不在该课程教学团队中");
        }
    }

    private CourseResponse toResponse(CourseEntity course) {
        return new CourseResponse(
                course.getId(),
                course.getName(),
                course.getDescription(),
                course.getTeacherId(),
                course.getTeacherName(),
                (int) courseMemberRepository.countByCourseId(course.getId()),
                0,
                course.getStatus(),
                course.getCreatedAt(),
                course.getUpdatedAt()
        );
    }

    private void replaceMembers(String courseId, List<String> groupIds, List<String> studentIds) {
        List<String> selectedGroupIds = groupIds == null ? Collections.emptyList() : groupIds;
        List<String> selectedStudentIds = studentIds == null ? Collections.emptyList() : studentIds;
        Set<String> memberIds = new HashSet<>(selectedStudentIds);
        memberIds.addAll(studentManagementService.studentIdsForGroups(selectedGroupIds));
        if (!memberIds.isEmpty() && !studentManagementService.allExist(List.copyOf(memberIds))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "包含不存在的学生");
        }
        courseMemberRepository.deleteByCourseId(courseId);
        memberIds.forEach(studentId -> courseMemberRepository.save(
                new CourseMemberEntity(UUID.randomUUID().toString(), courseId, studentId)
        ));
    }

    private void replaceStaff(String courseId, List<String> staffIds, AppPrincipal principal) {
        Set<String> selected = new HashSet<>(staffIds == null ? List.of() : staffIds);
        selected.add(principal.userId());
        Map<String, String> staffNames = permissions.requireTeachingStaff(List.copyOf(selected));
        courseStaffRepository.deleteByCourseId(courseId);
        selected.forEach(userId -> courseStaffRepository.save(new CourseStaffEntity(
                UUID.randomUUID().toString(),
                courseId,
                userId,
                staffNames.get(userId)
        )));
    }
}
