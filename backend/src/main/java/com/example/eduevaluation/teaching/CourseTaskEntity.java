package com.example.eduevaluation.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "course_tasks")
class CourseTaskEntity {
    @Id private String id;
    @Column(name = "course_id", nullable = false) private String courseId;
    @Column(nullable = false) private String title;
    @Column(nullable = false, columnDefinition = "TEXT") private String description;
    private LocalDateTime deadline;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private TaskStatus status;
    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    protected CourseTaskEntity() {}
    CourseTaskEntity(String id, String courseId, String title, String description, LocalDateTime deadline) {
        this.id = id; this.courseId = courseId; this.title = title; this.description = description; this.deadline = deadline;
        this.status = TaskStatus.DRAFT;
    }
    @PrePersist void created() { createdAt = LocalDateTime.now(); updatedAt = createdAt; }
    @PreUpdate void updated() { updatedAt = LocalDateTime.now(); }
    String getId() { return id; } String getCourseId() { return courseId; } String getTitle() { return title; }
    String getDescription() { return description; } LocalDateTime getDeadline() { return deadline; } TaskStatus getStatus() { return status; }
    void update(String title, String description, LocalDateTime deadline, TaskStatus status) {
        this.title = title; this.description = description; this.deadline = deadline; this.status = status;
    }
}
