CREATE TABLE submission_comments (
    id         VARCHAR(36)  NOT NULL,
    task_id    VARCHAR(36)  NOT NULL,
    student_id VARCHAR(36)  NOT NULL,
    author_role VARCHAR(16) NOT NULL,
    author_name VARCHAR(64) NOT NULL,
    content    TEXT         NOT NULL,
    created_at DATETIME     NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_comment_task_student (task_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
