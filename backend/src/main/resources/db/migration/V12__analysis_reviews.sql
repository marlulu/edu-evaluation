CREATE TABLE analysis_reviews (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    job_id VARCHAR(100) NOT NULL,
    student_id VARCHAR(36) NULL,
    ai_report_json JSON NULL,
    status VARCHAR(24) NOT NULL,
    review_rule_score DECIMAL(6,2) NULL,
    review_quality_score DECIMAL(6,2) NULL,
    review_comment TEXT NULL,
    reviewer_id VARCHAR(36) NULL,
    reviewed_at DATETIME NULL,
    published_at DATETIME NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_analysis_reviews_job (job_id),
    INDEX idx_analysis_reviews_student (student_id),
    INDEX idx_analysis_reviews_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
