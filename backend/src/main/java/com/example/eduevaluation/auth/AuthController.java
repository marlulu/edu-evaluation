package com.example.eduevaluation.auth;

import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final ModulePermissionService modulePermissions;

    public AuthController(AuthService authService, ModulePermissionService modulePermissions) {
        this.authService = authService;
        this.modulePermissions = modulePermissions;
    }
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) { return authService.login(request); }
    @PostMapping("/register/teacher")
    public AuthResponse registerTeacher(@Valid @RequestBody TeacherRegistrationRequest request) {
        return authService.registerTeacher(request);
    }
    @PostMapping("/register/student")
    public AuthResponse registerStudent(@Valid @RequestBody StudentRegistrationRequest request) {
        return authService.registerStudent(request);
    }
    @PostMapping("/assistants")
    public AuthResponse createAssistant(
            @Valid @RequestBody AssistantCreateRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return authService.createAssistant(request, principal);
    }
    @GetMapping("/me")
    public AuthResponse me(@AuthenticationPrincipal AppPrincipal principal) {
        return authService.me(principal);
    }

    @GetMapping("/admin/module-permissions")
    public List<ModulePermissionService.TeacherPermissionResponse> listPermissions(
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return modulePermissions.listTeachers(principal);
    }

    @PutMapping("/admin/module-permissions/{userId}")
    public ModulePermissionService.TeacherPermissionResponse updatePermissions(
            @PathVariable String userId,
            @Valid @RequestBody ModulePermissionService.TeacherPermissionRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return modulePermissions.update(userId, request, principal);
    }
}
