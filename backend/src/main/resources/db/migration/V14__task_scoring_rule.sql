ALTER TABLE task_submission_rules
    ADD COLUMN scoring_rule_text TEXT NULL AFTER rule_text;
