CREATE TABLE course_attachments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    object_key VARCHAR(600) NOT NULL,
    uploaded_at DATETIME NOT NULL,
    INDEX idx_course_attachments_course (course_id, uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
