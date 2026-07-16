package com.example.eduevaluation.studentmanagement;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface SharedStudentRepository extends JpaRepository<SharedStudentEntity, String> {
    Optional<SharedStudentEntity> findByStudentNumber(String studentNumber);
}

interface StudentGroupRepository extends JpaRepository<StudentGroupEntity, String> {
    boolean existsByName(String name);
}

interface GroupMembershipRepository extends JpaRepository<GroupMembership, GroupMembership> {
    List<GroupMembership> findByGroupIdIn(List<String> groupIds);
    void deleteByStudentId(String studentId);
    void deleteByGroupId(String groupId);
}
