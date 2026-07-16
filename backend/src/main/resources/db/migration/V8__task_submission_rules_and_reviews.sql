CREATE TABLE task_submission_rules (
    task_id VARCHAR(36) NOT NULL PRIMARY KEY,
    allowed_extensions VARCHAR(500) NOT NULL DEFAULT '',
    max_file_size_bytes BIGINT NOT NULL DEFAULT 52428800,
    rule_text TEXT NULL,
    imported_file_name VARCHAR(255) NULL,
    imported_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE task_submissions
    ADD COLUMN content_type VARCHAR(120) NULL,
    ADD COLUMN file_size_bytes BIGINT NULL;

CREATE TABLE task_submission_reviews (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    submission_id VARCHAR(36) NOT NULL,
    score DECIMAL(6,2) NULL,
    feedback TEXT NULL,
    status VARCHAR(20) NOT NULL,
    ai_task_id VARCHAR(100) NULL,
    reviewer_id VARCHAR(36) NULL,
    reviewed_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_task_submission_reviews_submission (submission_id),
    INDEX idx_task_submission_reviews_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
