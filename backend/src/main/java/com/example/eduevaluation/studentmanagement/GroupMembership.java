package com.example.eduevaluation.studentmanagement;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;

@Entity
@Table(name = "student_group_memberships")
@IdClass(GroupMembership.class)
class GroupMembership implements Serializable {
    @Id private String studentId;
    @Id private String groupId;
    protected GroupMembership() {}
    GroupMembership(String studentId, String groupId) { this.studentId = studentId; this.groupId = groupId; }
    String getStudentId() { return studentId; }
    String getGroupId() { return groupId; }
    @Override public boolean equals(Object value) {
        return value instanceof GroupMembership other && Objects.equals(studentId, other.studentId) && Objects.equals(groupId, other.groupId);
    }
    @Override public int hashCode() { return Objects.hash(studentId, groupId); }
}
