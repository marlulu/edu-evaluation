CREATE TABLE course_staff (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    teacher_name VARCHAR(100) NOT NULL,
    INDEX idx_course_staff_course_id (course_id),
    UNIQUE KEY uq_course_staff_teacher (course_id, teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE course_groups (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    group_id VARCHAR(36) NOT NULL,
    INDEX idx_course_groups_course_id (course_id),
    UNIQUE KEY uq_course_groups_group (course_id, group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE course_students (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    INDEX idx_course_students_course_id (course_id),
    UNIQUE KEY uq_course_students_student (course_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
