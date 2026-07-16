package com.example.eduevaluation.auth;

import java.util.UUID;
import com.example.eduevaluation.studentmanagement.StudentAccountService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService implements CommandLineRunner {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService tokens;
    private final ModulePermissionService modulePermissions;
    private final StudentAccountService studentAccounts;

    public AuthService(
            UserRepository users,
            PasswordEncoder passwordEncoder,
            JwtTokenService tokens,
            ModulePermissionService modulePermissions,
            StudentAccountService studentAccounts
    ) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.modulePermissions = modulePermissions;
        this.studentAccounts = studentAccounts;
    }
    @Override public void run(String... args) {
        seed("admin", "admin123", "系统管理员", UserRole.ADMIN);
        seed("teacher01", "teacher123", "课程教师", UserRole.TEACHER);
        seed("assistant01", "assistant123", "教师助理", UserRole.ASSISTANT);
        seed("student01", "student123", "学生", UserRole.STUDENT);
    }
    public AuthResponse login(LoginRequest request) {
        AppUser user = users.findByUsername(request.username().trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "账号或密码不正确"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "账号或密码不正确");
        return response(user);
    }
    public AuthResponse registerTeacher(TeacherRegistrationRequest request) {
        String username = request.username().trim();
        if (users.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "账号已存在");
        }
        AppUser user = users.save(new AppUser(
                UUID.randomUUID().toString(),
                username,
                passwordEncoder.encode(request.password()),
                request.displayName().trim(),
                UserRole.TEACHER
        ));
        modulePermissions.grantDefaults(user.getId());
        return response(user);
    }

    public AuthResponse registerStudent(StudentRegistrationRequest request) {
        String username = request.username().trim();
        if (users.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "账号已存在");
        }
        StudentAccountService.StudentAccount student = studentAccounts.bind(request.studentNumber(), request.initialPassword());
        AppUser user = users.save(new AppUser(UUID.randomUUID().toString(), username,
                passwordEncoder.encode(request.password()), student.studentName(), UserRole.STUDENT, student.id()));
        return response(user);
    }

    public AuthResponse createAssistant(AssistantCreateRequest request, AppPrincipal principal) {
        if (principal.role() != UserRole.TEACHER && principal.role() != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅教师可创建助教账号");
        }
        String username = request.username().trim();
        if (users.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "账号已存在");
        }
        AppUser user = users.save(new AppUser(UUID.randomUUID().toString(), username,
                passwordEncoder.encode(request.password()), request.displayName().trim(), UserRole.ASSISTANT));
        modulePermissions.grantDefaults(user.getId());
        return response(user);
    }
    public AuthResponse me(AppPrincipal principal) {
        AppUser user = users.findById(principal.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录状态已失效"));
        return new AuthResponse(null, "Bearer", tokens.getTokenSeconds(), user.getId(), user.getUsername(), user.getDisplayName(), user.getRole(), user.getStudentId());
    }
    private AuthResponse response(AppUser user) {
        JwtTokenService.IssuedToken token = tokens.issue(user);
        return new AuthResponse(token.value(), "Bearer", tokens.getTokenSeconds(), user.getId(), user.getUsername(), user.getDisplayName(), user.getRole(), user.getStudentId());
    }
    private void seed(String username, String password, String name, UserRole role) {
        if (users.findByUsername(username).isEmpty()) {
            AppUser user = users.save(new AppUser(UUID.randomUUID().toString(), username, passwordEncoder.encode(password), name, role));
            if (role == UserRole.TEACHER || role == UserRole.ASSISTANT) {
                modulePermissions.grantDefaults(user.getId());
            }
        } else if (role == UserRole.TEACHER || role == UserRole.ASSISTANT) {
            users.findByUsername(username).ifPresent(user -> modulePermissions.grantDefaults(user.getId()));
        }
    }
}
