-- ============================================================
--  教育评估系统 — MySQL 初始化脚本
--  首次启动时自动执行
-- ============================================================

-- 设置字符集
ALTER DATABASE edu_evaluation CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 作品分析任务表
CREATE TABLE IF NOT EXISTS work_tasks (
    task_id VARCHAR(36) PRIMARY KEY,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(20) COMMENT '文件类型: video, audio, document',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress DOUBLE NOT NULL DEFAULT 0,
    result_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_file_type (file_type),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 班级表
CREATE TABLE IF NOT EXISTS classes (
    class_id VARCHAR(36) PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_class_name (class_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 学生表
CREATE TABLE IF NOT EXISTS students (
    student_id VARCHAR(36) PRIMARY KEY,
    class_id VARCHAR(36) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    student_number VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    INDEX idx_class_id (class_id),
    INDEX idx_student_name (student_name),
    INDEX idx_student_number (student_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 学生作品关联表
CREATE TABLE IF NOT EXISTS student_works (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES work_tasks(task_id) ON DELETE CASCADE,
    INDEX idx_student_id (student_id),
    INDEX idx_task_id (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建只读用户（用于报表查询，可选）
-- CREATE USER 'edu_readonly'@'%' IDENTIFIED BY 'readonly_password';
-- GRANT SELECT ON edu_evaluation.* TO 'edu_readonly'@'%';
-- FLUSH PRIVILEGES;
