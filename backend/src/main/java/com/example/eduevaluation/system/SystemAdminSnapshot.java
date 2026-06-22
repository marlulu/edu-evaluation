package com.example.eduevaluation.system;

import java.util.List;

public record SystemAdminSnapshot(
    List<SystemUser> users,
    List<RubricTemplate> templates,
    List<ModelConfig> modelConfigs,
    List<AuditLog> auditLogs,
    List<BackupRecord> backups
) {
}
