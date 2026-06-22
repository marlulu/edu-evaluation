package com.example.eduevaluation.system;

public record AuditLogQuery(
    String actor,
    String action,
    String objectType,
    String result
) {
}

