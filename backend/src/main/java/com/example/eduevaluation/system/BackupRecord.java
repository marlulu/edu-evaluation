package com.example.eduevaluation.system;

import java.time.Instant;

public record BackupRecord(
    String id,
    String name,
    String scope,
    BackupStatus status,
    String operator,
    String storagePath,
    Instant createdAt,
    Instant restoredAt
) {
}

