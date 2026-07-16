package com.example.eduevaluation.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "task_submissions")
class TaskSubmissionEntity {
    @Id private String id;
    @Column(name = "task_id", nullable = false) private String taskId;
    @Column(name = "student_id", nullable = false) private String studentId;
    @Column(name = "object_key", nullable = false) private String objectKey;
    @Column(name = "file_name", nullable = false) private String fileName;
    @Column(name = "content_type") private String contentType;
    @Column(name = "file_size_bytes") private Long fileSizeBytes;
    @Column(name = "submitted_at", nullable = false) private LocalDateTime submittedAt;
    protected TaskSubmissionEntity() {}
    TaskSubmissionEntity(String id, String taskId, String studentId, String objectKey, String fileName,
                         String contentType, long fileSizeBytes) {
        this.id = id; this.taskId = taskId; this.studentId = studentId; this.objectKey = objectKey; this.fileName = fileName;
        this.contentType = contentType; this.fileSizeBytes = fileSizeBytes;
        this.submittedAt = LocalDateTime.now();
    }
    void replace(String objectKey, String fileName, String contentType, long fileSizeBytes) {
        this.objectKey = objectKey; this.fileName = fileName; this.contentType = contentType;
        this.fileSizeBytes = fileSizeBytes; this.submittedAt = LocalDateTime.now();
    }
    String getId() { return id; } String getTaskId() { return taskId; } String getStudentId() { return studentId; } String getFileName() { return fileName; }
    String getObjectKey() { return objectKey; } String getContentType() { return contentType; } Long getFileSizeBytes() { return fileSizeBytes; }
    LocalDateTime getSubmittedAt() { return submittedAt; }
}
