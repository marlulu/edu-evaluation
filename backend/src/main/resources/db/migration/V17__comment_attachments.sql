ALTER TABLE submission_comments
    ADD COLUMN attachment_object_key VARCHAR(512) NULL AFTER content,
    ADD COLUMN attachment_file_name  VARCHAR(255) NULL AFTER attachment_object_key,
    ADD COLUMN attachment_content_type VARCHAR(128) NULL AFTER attachment_file_name;
