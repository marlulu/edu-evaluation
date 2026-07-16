package com.example.eduevaluation.auth;

import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ModulePermissionService {

    public static final String COURSE = "COURSE";
    public static final String STUDENT = "STUDENT";
    public static final String TASK = "TASK";
    private static final Set<String> DEFAULT_MODULES = Set.of(COURSE, STUDENT, TASK);

    private final ModulePermissionRepository permissions;
    private final UserRepository users;

    public ModulePermissionService(ModulePermissionRepository permissions, UserRepository users) {
        this.permissions = permissions;
        this.users = users;
    }

    public void require(AppPrincipal principal, String moduleName, ModuleAction action) {
        if (principal.role() == UserRole.ADMIN) {
            return;
        }
        if (principal.role() != UserRole.TEACHER && principal.role() != UserRole.ASSISTANT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前角色无权执行此操作");
        }
        if (!permissions.existsByUserIdAndModuleNameAndPermissionName(principal.userId(), moduleName, action)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前账号未获得该模块操作权限");
        }
    }

    public void grantDefaults(String userId) {
        DEFAULT_MODULES.forEach(module -> {
            for (ModuleAction action : List.of(ModuleAction.VIEW, ModuleAction.CREATE, ModuleAction.EDIT)) {
                permissions.save(new ModulePermission(userId, module, action));
            }
        });
    }

    public List<TeacherPermissionResponse> listTeachers(AppPrincipal principal) {
        requireAdmin(principal);
        Map<String, List<ModulePermission>> byUser = permissions.findAll().stream()
                .collect(Collectors.groupingBy(ModulePermission::getUserId));
        return users.findByRoleIn(List.of(UserRole.TEACHER, UserRole.ASSISTANT)).stream()
                .map(user -> new TeacherPermissionResponse(
                        user.getId(),
                        user.getUsername(),
                        user.getDisplayName(),
                        user.getRole(),
                        permissionsFor(byUser.getOrDefault(user.getId(), List.of()))
                )).toList();
    }

    public List<TeachingStaffOption> listTeachingStaff(AppPrincipal principal) {
        require(principal, COURSE, ModuleAction.VIEW);
        return users.findByRoleIn(List.of(UserRole.TEACHER, UserRole.ASSISTANT)).stream()
                .map(user -> new TeachingStaffOption(user.getId(), user.getDisplayName(), user.getRole()))
                .toList();
    }

    public Map<String, String> requireTeachingStaff(List<String> userIds) {
        return userIds.stream().distinct().collect(Collectors.toMap(
                userId -> userId,
                userId -> {
                    AppUser user = users.findById(userId)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "包含不存在的协作教师"));
                    if (user.getRole() != UserRole.TEACHER && user.getRole() != UserRole.ASSISTANT) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "协作教师必须是教师或助教账号");
                    }
                    return user.getDisplayName();
                }
        ));
    }

    @Transactional
    public TeacherPermissionResponse update(String userId, TeacherPermissionRequest request, AppPrincipal principal) {
        requireAdmin(principal);
        AppUser user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        if (user.getRole() != UserRole.TEACHER && user.getRole() != UserRole.ASSISTANT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "只能配置教师或助教权限");
        }
        if (!DEFAULT_MODULES.contains(request.moduleName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "未知模块");
        }
        if (request.actions() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "权限操作不能为空");
        }
        permissions.deleteByUserIdAndModuleName(userId, request.moduleName());
        request.actions().stream().distinct().forEach(action ->
                permissions.save(new ModulePermission(userId, request.moduleName(), action)));
        return new TeacherPermissionResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole(),
                permissionsFor(permissions.findByUserId(userId)));
    }

    private void requireAdmin(AppPrincipal principal) {
        if (principal.role() != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅系统管理员可配置权限");
        }
    }

    private List<ModulePermissions> permissionsFor(List<ModulePermission> values) {
        Map<String, List<ModuleAction>> actions = values.stream().collect(Collectors.groupingBy(
                ModulePermission::getModuleName,
                Collectors.mapping(ModulePermission::getPermissionName, Collectors.toList())
        ));
        return DEFAULT_MODULES.stream().sorted()
                .map(module -> new ModulePermissions(module, actions.getOrDefault(module, List.of())))
                .toList();
    }

    public record TeacherPermissionRequest(String moduleName, List<ModuleAction> actions) {}
    public record ModulePermissions(String moduleName, List<ModuleAction> actions) {}
    public record TeacherPermissionResponse(String id, String username, String displayName, UserRole role,
                                            List<ModulePermissions> permissions) {}
    public record TeachingStaffOption(String id, String displayName, UserRole role) {}
}
