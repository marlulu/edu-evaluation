package com.example.eduevaluation.system;

public record BackupRequest(
    String name,
    String scope,
    String operator
) {
}

