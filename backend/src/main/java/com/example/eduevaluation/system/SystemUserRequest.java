package com.example.eduevaluation.system;

import java.util.List;

public record SystemUserRequest(
    String username,
    String displayName,
    String email,
    List<UserRole> roles,
    List<String> permissions,
    List<String> dataScopes,
    UserStatus status
) {
}

