CREATE INDEX idx_students_class_created_at ON students (class_id, created_at);

CREATE INDEX idx_student_works_student_assignment ON student_works (student_id, assignment_id);

CREATE INDEX idx_student_works_task_student ON student_works (task_id, student_id);

CREATE INDEX idx_assignments_status_created_at ON assignments (status, created_at);
