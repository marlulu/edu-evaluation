package com.example.eduevaluation.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "course_students")
class CourseMemberEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "course_id", nullable = false, length = 36)
    private String courseId;

    @Column(name = "student_id", nullable = false, length = 36)
    private String studentId;

    protected CourseMemberEntity() {
    }

    CourseMemberEntity(String id, String courseId, String studentId) {
        this.id = id;
        this.courseId = courseId;
        this.studentId = studentId;
    }
}
