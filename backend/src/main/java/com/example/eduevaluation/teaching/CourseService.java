package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.classroom.ClassEntity;
import com.example.eduevaluation.classroom.ClassRepository;
import com.example.eduevaluation.classroom.StudentEntity;
import com.example.eduevaluation.classroom.StudentRepository;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
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
    private final ClassRepository classRepository;
    private final StudentRepository studentRepository;

    public CourseService(
            CourseRepository courseRepository,
            CourseMemberRepository courseMemberRepository,
            ClassRepository classRepository,
            StudentRepository studentRepository
    ) {
        this.courseRepository = courseRepository;
        this.courseMemberRepository = courseMemberRepository;
        this.classRepository = classRepository;
        this.studentRepository = studentRepository;
    }

    @Transactional(readOnly = true)
    public List<CourseResponse> list(CourseStatus status, AppPrincipal principal) {
        requireTeachingRole(principal);
        List<CourseEntity> courses = status == null
                ? courseRepository.findAllByOrderByUpdatedAtDesc()
                : courseRepository.findByStatusOrderByUpdatedAtDesc(status);
        return courses.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CourseResponse get(String courseId, AppPrincipal principal) {
        requireTeachingRole(principal);
        return toResponse(requireCourse(courseId));
    }

    @Transactional(readOnly = true)
    public CourseOptionsResponse options(AppPrincipal principal) {
        requireTeachingRole(principal);
        List<CourseGroupOption> groups = classRepository.findAllSummariesOrderByCreatedAtDesc().stream()
                .map(group -> new CourseGroupOption(group.classId(), group.className(), (int) group.studentCount()))
                .toList();
        List<CourseStudentOption> students = studentRepository.findAll().stream()
                .map(student -> new CourseStudentOption(
                        student.getStudentId(),
                        student.getStudentNumber(),
                        student.getStudentName()
                ))
                .toList();
        return new CourseOptionsResponse(groups, students);
    }

    @Transactional
    public CourseResponse create(CreateCourseRequest request, AppPrincipal principal) {
        requireTeachingRole(principal);
        CourseEntity course = new CourseEntity(
                UUID.randomUUID().toString(),
                request.name().trim(),
                request.description().trim(),
                principal.userId(),
                principal.username()
        );
        CourseEntity savedCourse = courseRepository.save(course);
        replaceMembers(savedCourse.getId(), request.groupIds(), request.studentIds());
        return toResponse(savedCourse);
    }

    @Transactional
    public CourseResponse update(String courseId, UpdateCourseRequest request, AppPrincipal principal) {
        requireCourseOwner(requireCourse(courseId), principal);
        CourseEntity course = requireCourse(courseId);
        if (course.getStatus() == CourseStatus.ARCHIVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已归档课程不能编辑");
        }
        course.setName(request.name().trim());
        course.setDescription(request.description().trim());
        CourseEntity savedCourse = courseRepository.save(course);
        if (request.groupIds() != null || request.studentIds() != null) {
            replaceMembers(savedCourse.getId(), request.groupIds(), request.studentIds());
        }
        return toResponse(savedCourse);
    }

    @Transactional
    public CourseResponse updateStatus(String courseId, CourseStatus targetStatus, AppPrincipal principal) {
        CourseEntity course = requireCourse(courseId);
        requireCourseOwner(course, principal);
        if (!isValidTransition(course.getStatus(), targetStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "课程状态不能这样流转");
        }
        course.setStatus(targetStatus);
        return toResponse(courseRepository.save(course));
    }

    @Transactional
    public void delete(String courseId, AppPrincipal principal) {
        CourseEntity course = requireCourse(courseId);
        requireCourseOwner(course, principal);
        courseMemberRepository.deleteByCourseId(courseId);
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
        if (!selectedGroupIds.isEmpty()) {
            studentRepository.findByClassIdIn(selectedGroupIds)
                    .forEach(student -> memberIds.add(student.getStudentId()));
        }
        if (!memberIds.isEmpty() && studentRepository.findByStudentIdIn(List.copyOf(memberIds)).size() != memberIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "包含不存在的学生");
        }
        courseMemberRepository.deleteByCourseId(courseId);
        memberIds.forEach(studentId -> courseMemberRepository.save(
                new CourseMemberEntity(UUID.randomUUID().toString(), courseId, studentId)
        ));
    }
}
