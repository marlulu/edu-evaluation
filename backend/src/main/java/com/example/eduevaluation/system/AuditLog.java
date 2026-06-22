package com.example.eduevaluation.system;

import java.time.Instant;

public record AuditLog(
    String id,
    String actor,
    Instant operatedAt,
    String action,
    String objectType,
    String objectId,
    String result,
    String detail
) {
}

