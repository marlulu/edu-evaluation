package com.example.eduevaluation.auth;

public record AuthResponse(String accessToken, String tokenType, long expiresIn, String id, String username, String displayName, UserRole role, String studentId) {}
