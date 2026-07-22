package com.example.eduevaluation.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "task_submission_rules")
class TaskSubmissionRuleEntity {
    static final long DEFAULT_MAX_FILE_SIZE_BYTES = 50L * 1024 * 1024;
    @Id
    @Column(name = "task_id")
    private String taskId;
    @Column(name = "allowed_extensions", nullable = false)
    private String allowedExtensions = "";
    @Column(name = "max_file_size_bytes", nullable = false)
    private long maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES;
    @Column(name = "rule_text", columnDefinition = "TEXT")
    private String ruleText;
    @Column(name = "scoring_rule_text", columnDefinition = "TEXT")
    private String scoringRuleText;
    @Column(name = "imported_file_name")
    private String importedFileName;
    @Column(name = "imported_at")
    private LocalDateTime importedAt;

    protected TaskSubmissionRuleEntity() {}

    TaskSubmissionRuleEntity(String taskId) {
        this.taskId = taskId;
    }

    String getTaskId() { return taskId; }
    String getAllowedExtensions() { return allowedExtensions; }
    long getMaxFileSizeBytes() { return maxFileSizeBytes; }
    String getRuleText() { return ruleText; }
    String getScoringRuleText() { return scoringRuleText; }
    String getImportedFileName() { return importedFileName; }
    LocalDateTime getImportedAt() { return importedAt; }

    void update(String allowedExtensions, long maxFileSizeBytes, String ruleText, String importedFileName) {
        update(allowedExtensions, maxFileSizeBytes, ruleText, null, importedFileName);
    }

    void update(String allowedExtensions, long maxFileSizeBytes, String ruleText, String scoringRuleText, String importedFileName) {
        this.allowedExtensions = allowedExtensions;
        this.maxFileSizeBytes = maxFileSizeBytes;
        this.ruleText = ruleText;
        this.scoringRuleText = scoringRuleText;
        this.importedFileName = importedFileName;
        this.importedAt = importedFileName == null ? null : LocalDateTime.now();
    }
}
