-- 班级表
CREATE TABLE IF NOT EXISTS classes (
    class_id VARCHAR(36) NOT NULL PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 学生表
CREATE TABLE IF NOT EXISTS students (
    student_id VARCHAR(36) NOT NULL PRIMARY KEY,
    class_id VARCHAR(36) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    student_number VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_students_class_id (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 作业任务表
CREATE TABLE IF NOT EXISTS work_tasks (
    task_id VARCHAR(36) NOT NULL PRIMARY KEY,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress DOUBLE NOT NULL DEFAULT 0,
    result_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 布置任务表
CREATE TABLE IF NOT EXISTS assignments (
    assignment_id VARCHAR(36) NOT NULL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    criteria_text TEXT,
    criteria_file_name VARCHAR(500),
    class_id VARCHAR(36),
    deadline DATETIME,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_assignments_class_id (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 学生作品表
CREATE TABLE IF NOT EXISTS student_works (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NOT NULL,
    assignment_id VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_works_student_id (student_id),
    INDEX idx_student_works_task_id (task_id),
    INDEX idx_student_works_assignment_id (assignment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
