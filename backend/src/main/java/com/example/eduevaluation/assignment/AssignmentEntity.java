package com.example.eduevaluation.assignment;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "assignments")
public class AssignmentEntity {

    @Id
    @Column(name = "assignment_id", length = 36)
    private String assignmentId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "criteria_text", columnDefinition = "TEXT")
    private String criteriaText;

    @Column(name = "criteria_file_name", length = 500)
    private String criteriaFileName;

    @Column(name = "class_id", length = 36)
    private String classId;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "assignment_classes",
            joinColumns = @JoinColumn(name = "assignment_id"))
    @Column(name = "class_id", length = 36)
    private Set<String> classIds = new LinkedHashSet<>();

    @Column(columnDefinition = "DATETIME")
    private LocalDateTime deadline;

    @Column(nullable = false, length = 20)
    private String status = "active";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public AssignmentEntity() {
    }

    public AssignmentEntity(String assignmentId, String title, String description) {
        this.assignmentId = assignmentId;
        this.title = title;
        this.description = description;
        this.status = "active";
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    // Getters and Setters

    public String getAssignmentId() {
        return assignmentId;
    }

    public void setAssignmentId(String assignmentId) {
        this.assignmentId = assignmentId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCriteriaText() {
        return criteriaText;
    }

    public void setCriteriaText(String criteriaText) {
        this.criteriaText = criteriaText;
    }

    public String getCriteriaFileName() {
        return criteriaFileName;
    }

    public void setCriteriaFileName(String criteriaFileName) {
        this.criteriaFileName = criteriaFileName;
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public Set<String> getClassIds() {
        return classIds;
    }

    public void setClassIds(Set<String> classIds) {
        this.classIds = classIds == null ? new LinkedHashSet<>() : new LinkedHashSet<>(classIds);
        this.classId = this.classIds.stream().findFirst().orElse(null);
    }

    public LocalDateTime getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDateTime deadline) {
        this.deadline = deadline;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
