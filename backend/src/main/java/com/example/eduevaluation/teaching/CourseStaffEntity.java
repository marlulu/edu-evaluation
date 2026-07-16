package com.example.eduevaluation.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "course_staff")
class CourseStaffEntity {
    @Id
    private String id;
    @Column(name = "course_id", nullable = false)
    private String courseId;
    @Column(name = "teacher_id", nullable = false)
    private String teacherId;
    @Column(name = "teacher_name", nullable = false)
    private String teacherName;

    protected CourseStaffEntity() {
    }

    CourseStaffEntity(String id, String courseId, String teacherId, String teacherName) {
        this.id = id;
        this.courseId = courseId;
        this.teacherId = teacherId;
        this.teacherName = teacherName;
    }

    String getTeacherId() {
        return teacherId;
    }
}
