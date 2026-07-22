ALTER TABLE task_submissions DROP INDEX uq_task_submissions_current;

CREATE INDEX idx_task_submissions_task_student_time
    ON task_submissions (task_id, student_id, submitted_at);
