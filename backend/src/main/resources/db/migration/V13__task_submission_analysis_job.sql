ALTER TABLE task_submissions
    ADD COLUMN analysis_job_id VARCHAR(100) NULL;

CREATE INDEX idx_task_submissions_analysis_job
    ON task_submissions (analysis_job_id);
