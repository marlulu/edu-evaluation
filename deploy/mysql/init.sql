-- ============================================================
--  教育评估系统 — MySQL 初始化脚本
--  首次启动时自动执行
-- ============================================================

-- 设置字符集
ALTER DATABASE edu_evaluation CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 视频分析任务表
CREATE TABLE IF NOT EXISTS video_tasks (
    task_id VARCHAR(36) PRIMARY KEY,
    file_name VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress DOUBLE NOT NULL DEFAULT 0,
    result_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建只读用户（用于报表查询，可选）
-- CREATE USER 'edu_readonly'@'%' IDENTIFIED BY 'readonly_password';
-- GRANT SELECT ON edu_evaluation.* TO 'edu_readonly'@'%';
-- FLUSH PRIVILEGES;
