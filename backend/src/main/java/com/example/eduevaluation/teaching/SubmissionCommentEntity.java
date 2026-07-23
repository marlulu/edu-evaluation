package com.example.eduevaluation.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "submission_comments")
class SubmissionCommentEntity {
    @Id
    private String id;

    @Column(name = "task_id", nullable = false)
    private String taskId;

    @Column(name = "student_id", nullable = false)
    private String studentId;

    @Column(name = "author_role", nullable = false, length = 16)
    private String authorRole;

    @Column(name = "author_name", nullable = false, length = 64)
    private String authorName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "attachment_object_key", length = 512)
    private String attachmentObjectKey;

    @Column(name = "attachment_file_name", length = 255)
    private String attachmentFileName;

    @Column(name = "attachment_content_type", length = 128)
    private String attachmentContentType;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected SubmissionCommentEntity() {}

    SubmissionCommentEntity(String id, String taskId, String studentId, String authorRole, String authorName, String content) {
        this.id = id;
        this.taskId = taskId;
        this.studentId = studentId;
        this.authorRole = authorRole;
        this.authorName = authorName;
        this.content = content;
        this.createdAt = LocalDateTime.now();
    }

    String getId() { return id; }
    String getTaskId() { return taskId; }
    String getStudentId() { return studentId; }
    String getAuthorRole() { return authorRole; }
    String getAuthorName() { return authorName; }
    String getContent() { return content; }
    String getAttachmentObjectKey() { return attachmentObjectKey; }
    String getAttachmentFileName() { return attachmentFileName; }
    String getAttachmentContentType() { return attachmentContentType; }
    LocalDateTime getCreatedAt() { return createdAt; }

    void setAttachmentObjectKey(String attachmentObjectKey) { this.attachmentObjectKey = attachmentObjectKey; }
    void setAttachmentFileName(String attachmentFileName) { this.attachmentFileName = attachmentFileName; }
    void setAttachmentContentType(String attachmentContentType) { this.attachmentContentType = attachmentContentType; }
}
