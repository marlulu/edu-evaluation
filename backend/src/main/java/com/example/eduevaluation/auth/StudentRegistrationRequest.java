package com.example.eduevaluation.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StudentRegistrationRequest(
        @NotBlank String studentNumber,
        @NotBlank String initialPassword,
        @NotBlank @Size(min = 4, max = 80) String username,
        @NotBlank @Size(min = 8, max = 100) String password
) {
}
