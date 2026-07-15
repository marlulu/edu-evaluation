package com.example.eduevaluation.auth;

import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    public AuthController(AuthService authService) { this.authService = authService; }
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) { return authService.login(request); }
    @PostMapping("/register/teacher")
    public AuthResponse registerTeacher(@Valid @RequestBody TeacherRegistrationRequest request) {
        return authService.registerTeacher(request);
    }
    @GetMapping("/me")
    public AuthResponse me(@AuthenticationPrincipal AppPrincipal principal) {
        return authService.me(principal);
    }
}
