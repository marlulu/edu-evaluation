package com.example.eduevaluation.system;

import java.time.Instant;
import java.util.List;

public record SystemUser(
    String id,
    String username,
    String displayName,
    String email,
    List<UserRole> roles,
    List<String> permissions,
    List<String> dataScopes,
    UserStatus status,
    Instant createdAt,
    Instant updatedAt
) {
}

