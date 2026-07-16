package com.example.eduevaluation.studentmanagement;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StudentManagementService {
    private final SharedStudentRepository students;
    private final StudentGroupRepository groups;
    private final GroupMembershipRepository memberships;
    private final ModulePermissionService permissions;

    public StudentManagementService(
            SharedStudentRepository students,
            StudentGroupRepository groups,
            GroupMembershipRepository memberships,
            ModulePermissionService permissions
    ) {
        this.students = students;
        this.groups = groups;
        this.memberships = memberships;
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> listStudents(AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.VIEW);
        Map<String, List<String>> groupNames = memberships.findAll().stream()
                .collect(Collectors.groupingBy(GroupMembership::getStudentId,
                        Collectors.mapping(GroupMembership::getGroupId, Collectors.toList())));
        Map<String, String> names = groups.findAll().stream()
                .collect(Collectors.toMap(StudentGroupEntity::getId, StudentGroupEntity::getName));
        return students.findAll().stream()
                .map(student -> new StudentResponse(student.getId(), student.getStudentNumber(), student.getStudentName(),
                        student.getEmail(), groupNames.getOrDefault(student.getId(), List.of()).stream()
                                .map(names::get).filter(java.util.Objects::nonNull).toList(), null))
                .toList();
    }

    @Transactional
    public StudentResponse createStudent(StudentRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.CREATE);
        if (students.findByStudentNumber(request.studentNumber().trim()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "学号已存在");
        }
        String initialPassword = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        SharedStudentEntity student = students.save(new SharedStudentEntity(UUID.randomUUID().toString(),
                request.studentNumber().trim(), request.studentName().trim(), trimToNull(request.email()), initialPassword));
        replaceGroups(student.getId(), request.groupIds());
        return response(student, initialPassword);
    }

    @Transactional
    public StudentResponse updateStudent(String studentId, StudentRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.EDIT);
        SharedStudentEntity student = requireStudent(studentId);
        student.update(request.studentName().trim(), trimToNull(request.email()));
        replaceGroups(studentId, request.groupIds());
        return response(student, null);
    }

    @Transactional
    public void deleteStudent(String studentId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.DELETE);
        requireStudent(studentId);
        memberships.deleteByStudentId(studentId);
        students.deleteById(studentId);
    }

    public List<GroupResponse> listGroups(AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.VIEW);
        Map<String, Long> counts = memberships.findAll().stream()
                .collect(Collectors.groupingBy(GroupMembership::getGroupId, Collectors.counting()));
        return groups.findAll().stream().map(group -> new GroupResponse(group.getId(), group.getName(),
                counts.getOrDefault(group.getId(), 0L).intValue())).toList();
    }

    @Transactional(readOnly = true)
    public List<CourseGroupOption> courseGroups() {
        Map<String, Long> counts = memberships.findAll().stream()
                .collect(Collectors.groupingBy(GroupMembership::getGroupId, Collectors.counting()));
        return groups.findAll().stream()
                .map(group -> new CourseGroupOption(group.getId(), group.getName(),
                        counts.getOrDefault(group.getId(), 0L).intValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CourseStudentOption> courseStudents() {
        return students.findAll().stream()
                .map(student -> new CourseStudentOption(student.getId(), student.getStudentNumber(), student.getStudentName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> studentIdsForGroups(List<String> groupIds) {
        if (groupIds == null || groupIds.isEmpty()) {
            return List.of();
        }
        if (groups.findAllById(groupIds).size() != groupIds.stream().distinct().count()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "包含不存在的学生组别");
        }
        return memberships.findByGroupIdIn(groupIds).stream().map(GroupMembership::getStudentId).distinct().toList();
    }

    @Transactional(readOnly = true)
    public boolean allExist(List<String> studentIds) {
        return students.findAllById(studentIds).size() == studentIds.stream().distinct().count();
    }

    public GroupResponse createGroup(GroupRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.CREATE);
        String name = request.name().trim();
        if (groups.existsByName(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "组别名称已存在");
        }
        StudentGroupEntity group = groups.save(new StudentGroupEntity(UUID.randomUUID().toString(), name));
        return new GroupResponse(group.getId(), group.getName(), 0);
    }

    @Transactional
    public GroupResponse updateGroup(String groupId, GroupRequest request, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.EDIT);
        StudentGroupEntity group = groups.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "学生组别不存在"));
        String name = request.name().trim();
        if (!group.getName().equals(name) && groups.existsByName(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "组别名称已存在");
        }
        group.setName(name);
        return new GroupResponse(group.getId(), group.getName(), (int) memberships.findAll().stream()
                .filter(item -> item.getGroupId().equals(groupId)).count());
    }

    @Transactional
    public void deleteGroup(String groupId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.EDIT);
        if (!groups.existsById(groupId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "学生组别不存在");
        }
        memberships.deleteByGroupId(groupId);
        groups.deleteById(groupId);
    }

    private StudentResponse response(SharedStudentEntity student) {
        return response(student, null);
    }

    private StudentResponse response(SharedStudentEntity student, String initialPassword) {
        return new StudentResponse(student.getId(), student.getStudentNumber(), student.getStudentName(), student.getEmail(),
                memberships.findAll().stream().filter(item -> item.getStudentId().equals(student.getId()))
                        .map(GroupMembership::getGroupId).map(groups::findById).flatMap(java.util.Optional::stream)
                        .map(StudentGroupEntity::getName).toList(), initialPassword);
    }

    private void replaceGroups(String studentId, List<String> groupIds) {
        List<String> selected = groupIds == null ? List.of() : groupIds.stream().distinct().toList();
        if (groups.findAllById(selected).size() != selected.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "包含不存在的学生组别");
        }
        memberships.deleteByStudentId(studentId);
        selected.forEach(groupId -> memberships.save(new GroupMembership(studentId, groupId)));
    }

    private SharedStudentEntity requireStudent(String studentId) {
        return students.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "学生不存在"));
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record StudentRequest(String studentNumber, String studentName, String email, List<String> groupIds) {}
    public record StudentResponse(String id, String studentNumber, String studentName, String email, List<String> groupNames,
                                  String initialPassword) {}
    public record GroupRequest(String name) {}
    public record GroupResponse(String id, String name, int studentCount) {}
    public record CourseGroupOption(String id, String name, int studentCount) {}
    public record CourseStudentOption(String id, String studentNumber, String name) {}
}
