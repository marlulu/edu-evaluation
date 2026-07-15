package com.example.eduevaluation.classroom;

import com.example.eduevaluation.work.WorkTaskEntity;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "student_works")
public class StudentWorkEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "student_id", nullable = false, length = 36)
    private String studentId;

    @Column(name = "task_id", nullable = false, length = 36)
    private String taskId;

    @Column(name = "assignment_id", length = 36)
    private String assignmentId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", insertable = false, updatable = false)
    private StudentEntity student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", insertable = false, updatable = false)
    private WorkTaskEntity workTask;

    public StudentWorkEntity() {
    }

    public StudentWorkEntity(String id, String studentId, String taskId) {
        this(id, studentId, taskId, null);
    }

    public StudentWorkEntity(String id, String studentId, String taskId, String assignmentId) {
        this.id = id;
        this.studentId = studentId;
        this.taskId = taskId;
        this.assignmentId = assignmentId;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public String getAssignmentId() {
        return assignmentId;
    }

    public void setAssignmentId(String assignmentId) {
        this.assignmentId = assignmentId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public StudentEntity getStudent() {
        return student;
    }

    public void setStudent(StudentEntity student) {
        this.student = student;
    }

    public WorkTaskEntity getWorkTask() {
        return workTask;
    }

    public void setWorkTask(WorkTaskEntity workTask) {
        this.workTask = workTask;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
