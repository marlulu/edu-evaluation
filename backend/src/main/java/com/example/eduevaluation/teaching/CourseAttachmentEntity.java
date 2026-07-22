package com.example.eduevaluation.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "course_attachments")
class CourseAttachmentEntity {
    @Id private String id;
    @Column(name = "course_id", nullable = false) private String courseId;
    @Column(name = "file_name", nullable = false) private String fileName;
    @Column(name = "object_key", nullable = false) private String objectKey;
    @Column(name = "uploaded_at", nullable = false) private LocalDateTime uploadedAt;
    protected CourseAttachmentEntity() {}
    CourseAttachmentEntity(String id, String courseId, String fileName, String objectKey) {
        this.id = id; this.courseId = courseId; this.fileName = fileName; this.objectKey = objectKey; this.uploadedAt = LocalDateTime.now();
    }
    String getId() { return id; } String getCourseId() { return courseId; } String getFileName() { return fileName; } String getObjectKey() { return objectKey; }
}
