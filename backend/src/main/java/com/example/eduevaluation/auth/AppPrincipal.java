package com.example.eduevaluation.auth;

public record AppPrincipal(String userId, String username, UserRole role, String studentId) {
    static AppPrincipal from(AppUser user) {
        return new AppPrincipal(user.getId(), user.getUsername(), user.getRole(), user.getStudentId());
    }
}
