CREATE TABLE site_settings (
    setting_key   VARCHAR(64) NOT NULL,
    setting_value TEXT        NULL,
    updated_at    DATETIME    NOT NULL,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES
('footer_text', '', NOW()),
('icp_filing', '', NOW());
