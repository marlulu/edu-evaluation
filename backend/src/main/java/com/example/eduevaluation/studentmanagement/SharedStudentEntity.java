package com.example.eduevaluation.studentmanagement;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "shared_students")
class SharedStudentEntity {
    @Id private String id;
    @Column(name = "student_number", nullable = false) private String studentNumber;
    @Column(name = "student_name", nullable = false) private String studentName;
    private String email;
    @Column(name = "initial_password") private String initialPassword;

    protected SharedStudentEntity() {
    }

    SharedStudentEntity(String id, String studentNumber, String studentName, String email, String initialPassword) {
        this.id = id;
        this.studentNumber = studentNumber;
        this.studentName = studentName;
        this.email = email;
        this.initialPassword = initialPassword;
    }

    String getId() { return id; }
    String getStudentNumber() { return studentNumber; }
    String getStudentName() { return studentName; }
    String getEmail() { return email; }
    String getInitialPassword() { return initialPassword; }
    void update(String name, String email) { this.studentName = name; this.email = email; }
    void clearInitialPassword() { this.initialPassword = null; }
}
