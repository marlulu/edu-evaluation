ALTER TABLE task_submissions
    ADD COLUMN submission_batch_id VARCHAR(36) NULL;

UPDATE task_submissions
SET submission_batch_id = id
WHERE submission_batch_id IS NULL;

ALTER TABLE task_submissions
    MODIFY COLUMN submission_batch_id VARCHAR(36) NOT NULL;

CREATE INDEX idx_task_submissions_batch
    ON task_submissions (task_id, student_id, submission_batch_id, submitted_at);
