CREATE TABLE IF NOT EXISTS assignment_classes (
    assignment_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (assignment_id, class_id),
    INDEX idx_assignment_classes_class_id (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO assignment_classes (assignment_id, class_id)
SELECT assignment_id, class_id
FROM assignments
WHERE class_id IS NOT NULL;
