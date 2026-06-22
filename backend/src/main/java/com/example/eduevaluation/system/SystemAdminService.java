package com.example.eduevaluation.system;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SystemAdminService {

    private final Map<String, SystemUser> users = new ConcurrentHashMap<>();
    private final Map<String, RubricTemplate> templates = new ConcurrentHashMap<>();
    private final Map<String, ModelConfig> modelConfigs = new ConcurrentHashMap<>();
    private final Map<String, BackupRecord> backups = new ConcurrentHashMap<>();
    private final List<AuditLog> auditLogs = new ArrayList<>();

    public SystemAdminService() {
        seedDefaults();
    }

    public SystemAdminSnapshot snapshot() {
        return new SystemAdminSnapshot(
            listUsers(),
            listTemplates(),
            listModelConfigs(),
            listAuditLogs(new AuditLogQuery("", "", "", "")),
            listBackups()
        );
    }

    public List<SystemUser> listUsers() {
        return users.values().stream()
            .sorted(Comparator.comparing(SystemUser::createdAt))
            .toList();
    }

    public SystemUser createUser(SystemUserRequest request) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        SystemUser user = new SystemUser(
            id,
            requireText(request.username(), "用户名不能为空"),
            requireText(request.displayName(), "显示名称不能为空"),
            trimToEmpty(request.email()),
            defaultRoles(request.roles()),
            List.copyOf(nullToEmpty(request.permissions())),
            List.copyOf(nullToEmpty(request.dataScopes())),
            request.status() == null ? UserStatus.ACTIVE : request.status(),
            now,
            now
        );
        users.put(id, user);
        audit("system", "USER_CREATE", "USER", id, "SUCCESS", user.username());
        return user;
    }

    public SystemUser updateUser(String id, SystemUserRequest request) {
        SystemUser existing = requireUser(id);
        SystemUser updated = new SystemUser(
            id,
            requireText(request.username(), "用户名不能为空"),
            requireText(request.displayName(), "显示名称不能为空"),
            trimToEmpty(request.email()),
            defaultRoles(request.roles()),
            List.copyOf(nullToEmpty(request.permissions())),
            List.copyOf(nullToEmpty(request.dataScopes())),
            request.status() == null ? existing.status() : request.status(),
            existing.createdAt(),
            Instant.now()
        );
        users.put(id, updated);
        audit("system", "USER_UPDATE", "USER", id, "SUCCESS", updated.username());
        return updated;
    }

    public SystemUser disableUser(String id) {
        SystemUser existing = requireUser(id);
        SystemUser disabled = new SystemUser(
            existing.id(),
            existing.username(),
            existing.displayName(),
            existing.email(),
            existing.roles(),
            existing.permissions(),
            existing.dataScopes(),
            UserStatus.DISABLED,
            existing.createdAt(),
            Instant.now()
        );
        users.put(id, disabled);
        audit("system", "USER_DISABLE", "USER", id, "SUCCESS", disabled.username());
        return disabled;
    }

    public List<RubricTemplate> listTemplates() {
        return templates.values().stream()
            .sorted(Comparator.comparing(RubricTemplate::updatedAt).reversed())
            .toList();
    }

    public RubricTemplate createTemplate(RubricTemplateRequest request) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        List<RubricDimension> dimensions = validateDimensions(request.dimensions());
        RubricTemplateVersion version = new RubricTemplateVersion(
            UUID.randomUUID().toString(),
            1,
            requireText(request.name(), "模板名称不能为空"),
            trimToEmpty(request.description()),
            trimToEmpty(request.courseScope()),
            request.status() == null ? TemplateStatus.DRAFT : request.status(),
            dimensions,
            now
        );
        RubricTemplate template = new RubricTemplate(
            id,
            version.name(),
            version.description(),
            version.courseScope(),
            version.status(),
            1,
            dimensions,
            List.of(version),
            now,
            now
        );
        templates.put(id, template);
        audit("system", "TEMPLATE_CREATE", "RUBRIC_TEMPLATE", id, "SUCCESS", template.name());
        return template;
    }

    public RubricTemplate updateTemplate(String id, RubricTemplateRequest request) {
        RubricTemplate existing = requireTemplate(id);
        Instant now = Instant.now();
        int nextVersion = existing.currentVersion() + 1;
        List<RubricDimension> dimensions = validateDimensions(request.dimensions());
        RubricTemplateVersion version = new RubricTemplateVersion(
            UUID.randomUUID().toString(),
            nextVersion,
            requireText(request.name(), "模板名称不能为空"),
            trimToEmpty(request.description()),
            trimToEmpty(request.courseScope()),
            request.status() == null ? existing.status() : request.status(),
            dimensions,
            now
        );
        List<RubricTemplateVersion> history = new ArrayList<>(existing.history());
        history.add(version);
        RubricTemplate updated = new RubricTemplate(
            id,
            version.name(),
            version.description(),
            version.courseScope(),
            version.status(),
            nextVersion,
            dimensions,
            List.copyOf(history),
            existing.createdAt(),
            now
        );
        templates.put(id, updated);
        audit("system", "TEMPLATE_UPDATE", "RUBRIC_TEMPLATE", id, "SUCCESS", "version=" + nextVersion);
        return updated;
    }

    public RubricTemplate copyTemplate(String id) {
        RubricTemplate source = requireTemplate(id);
        RubricTemplate copy = createTemplate(
            new RubricTemplateRequest(
                source.name() + " 副本",
                source.description(),
                source.courseScope(),
                TemplateStatus.DRAFT,
                source.dimensions()
            )
        );
        audit("system", "TEMPLATE_COPY", "RUBRIC_TEMPLATE", copy.id(), "SUCCESS", "source=" + id);
        return copy;
    }

    public List<ModelConfig> listModelConfigs() {
        return modelConfigs.values().stream()
            .sorted(Comparator.comparing(ModelConfig::updatedAt).reversed())
            .toList();
    }

    public ModelConfig createModelConfig(ModelConfigRequest request) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        ModelConfig config = new ModelConfig(
            id,
            requireText(request.name(), "模型名称不能为空"),
            requireText(request.providerType(), "模型类型不能为空"),
            requireText(request.driver(), "驱动类型不能为空"),
            trimToEmpty(request.baseUrl()),
            requireText(request.defaultModel(), "默认模型不能为空"),
            maskApiKey(request.apiKey()),
            hasText(request.apiKey()),
            request.status() == null ? ModelConfigStatus.DISABLED : request.status(),
            List.copyOf(normalizeValues(request.capabilities())),
            trimToEmpty(request.notes()),
            now,
            now,
            null
        );
        modelConfigs.put(id, config);
        audit("system", "MODEL_CREATE", "MODEL_CONFIG", id, "SUCCESS", config.name());
        return config;
    }

    public ModelConfig updateModelConfig(String id, ModelConfigRequest request) {
        ModelConfig existing = requireModelConfig(id);
        Instant now = Instant.now();
        boolean keepExistingKey = !hasText(request.apiKey()) && existing.apiKeyConfigured();
        ModelConfig updated = new ModelConfig(
            id,
            requireText(request.name(), "模型名称不能为空"),
            requireText(request.providerType(), "模型类型不能为空"),
            requireText(request.driver(), "驱动类型不能为空"),
            trimToEmpty(request.baseUrl()),
            requireText(request.defaultModel(), "默认模型不能为空"),
            keepExistingKey ? existing.apiKeyMasked() : maskApiKey(request.apiKey()),
            keepExistingKey || hasText(request.apiKey()),
            request.status() == null ? existing.status() : request.status(),
            List.copyOf(normalizeValues(request.capabilities())),
            trimToEmpty(request.notes()),
            existing.createdAt(),
            now,
            now
        );
        modelConfigs.put(id, updated);
        audit("system", "MODEL_UPDATE", "MODEL_CONFIG", id, "SUCCESS", updated.name());
        return updated;
    }

    public List<AuditLog> listAuditLogs(AuditLogQuery query) {
        return auditLogs.stream()
            .filter(log -> matches(query.actor(), log.actor()))
            .filter(log -> matches(query.action(), log.action()))
            .filter(log -> matches(query.objectType(), log.objectType()))
            .filter(log -> matches(query.result(), log.result()))
            .sorted(Comparator.comparing(AuditLog::operatedAt).reversed())
            .toList();
    }

    public byte[] exportAuditLogs(AuditLogQuery query) {
        String header = "actor,operatedAt,action,objectType,objectId,result,detail\n";
        String body = listAuditLogs(query).stream()
            .map(log -> String.join(
                ",",
                csv(log.actor()),
                log.operatedAt().toString(),
                csv(log.action()),
                csv(log.objectType()),
                csv(log.objectId()),
                csv(log.result()),
                csv(log.detail())
            ))
            .collect(Collectors.joining("\n"));
        audit("system", "AUDIT_EXPORT", "AUDIT_LOG", "all", "SUCCESS", "exported");
        return (header + body + "\n").getBytes(StandardCharsets.UTF_8);
    }

    public List<BackupRecord> listBackups() {
        return backups.values().stream()
            .sorted(Comparator.comparing(BackupRecord::createdAt).reversed())
            .toList();
    }

    public BackupRecord createBackup(BackupRequest request) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        BackupRecord backup = new BackupRecord(
            id,
            requireText(request.name(), "备份名称不能为空"),
            trimToEmpty(request.scope()).isBlank()
                ? "作业文件、评分结果、评价模板、日志数据"
                : trimToEmpty(request.scope()),
            BackupStatus.READY,
            trimToEmpty(request.operator()).isBlank() ? "system" : request.operator().trim(),
            "backend/data/backups/" + id + ".snapshot",
            now,
            null
        );
        backups.put(id, backup);
        audit(backup.operator(), "BACKUP_CREATE", "BACKUP", id, "SUCCESS", backup.scope());
        return backup;
    }

    public BackupRecord restoreBackup(String id, String operator) {
        BackupRecord existing = requireBackup(id);
        BackupRecord restored = new BackupRecord(
            existing.id(),
            existing.name(),
            existing.scope(),
            BackupStatus.RESTORED,
            trimToEmpty(operator).isBlank() ? existing.operator() : operator.trim(),
            existing.storagePath(),
            existing.createdAt(),
            Instant.now()
        );
        backups.put(id, restored);
        audit(restored.operator(), "BACKUP_RESTORE", "BACKUP", id, "SUCCESS", restored.name());
        return restored;
    }

    private void seedDefaults() {
        SystemUser admin = createUser(
            new SystemUserRequest(
                "admin",
                "系统管理员",
                "admin@example.edu",
                List.of(UserRole.ADMIN),
                List.of("USER_MANAGE", "RUBRIC_MANAGE", "AUDIT_VIEW", "BACKUP_RESTORE"),
                List.of("ALL"),
                UserStatus.ACTIVE
            )
        );
        createUser(
            new SystemUserRequest(
                "teacher01",
                "示例教师",
                "teacher@example.edu",
                List.of(UserRole.TEACHER),
                List.of("ASSIGNMENT_MANAGE", "RUBRIC_MANAGE", "RESULT_REVIEW"),
                List.of("人工智能概论"),
                UserStatus.ACTIVE
            )
        );
        createTemplate(
            new RubricTemplateRequest(
                "人工智能概论默认评价模板",
                "覆盖概念、算法、案例、原创性、结构和表达。",
                "人工智能概论",
                TemplateStatus.ACTIVE,
                List.of(
                    new RubricDimension("AI 概念准确性", 25, "概念使用准确，术语解释清晰。"),
                    new RubricDimension("算法理解", 25, "能说明关键算法思想、适用场景和局限。"),
                    new RubricDimension("案例分析", 20, "结合实际案例分析问题、数据和结果。"),
                    new RubricDimension("原创性与结构表达", 30, "观点有独立性，结构完整，引用规范。")
                )
            )
        );
        createModelConfig(
            new ModelConfigRequest(
                "默认多模态模型网关",
                "MULTIMODAL",
                "openai-compatible",
                "https://api.example.com/v1",
                "gpt-4.1-mini",
                "",
                ModelConfigStatus.DISABLED,
                List.of("image", "video", "audio", "text", "fusion"),
                "管理员可在此接入并维护真实模型网关配置。"
            )
        );
        createModelConfig(
            new ModelConfigRequest(
                "默认文本评价模型",
                "TEXT",
                "openai-compatible",
                "https://api.example.com/v1",
                "gpt-4.1",
                "",
                ModelConfigStatus.TESTING,
                List.of("rubric-scoring", "issue-detection", "feedback-generation"),
                "用于智能评价模块的文本评分、问题识别和建议生成。"
            )
        );
        createBackup(
            new BackupRequest("初始演示备份", "评价模板、用户权限、日志数据", admin.username())
        );
    }

    private SystemUser requireUser(String id) {
        SystemUser user = users.get(id);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
        return user;
    }

    private RubricTemplate requireTemplate(String id) {
        RubricTemplate template = templates.get(id);
        if (template == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "评价模板不存在");
        }
        return template;
    }

    private ModelConfig requireModelConfig(String id) {
        ModelConfig config = modelConfigs.get(id);
        if (config == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "模型配置不存在");
        }
        return config;
    }

    private BackupRecord requireBackup(String id) {
        BackupRecord backup = backups.get(id);
        if (backup == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "备份不存在");
        }
        return backup;
    }

    private void audit(
        String actor,
        String action,
        String objectType,
        String objectId,
        String result,
        String detail
    ) {
        auditLogs.add(
            new AuditLog(
                UUID.randomUUID().toString(),
                actor,
                Instant.now(),
                action,
                objectType,
                objectId,
                result,
                detail
            )
        );
    }

    private List<UserRole> defaultRoles(List<UserRole> roles) {
        if (roles == null || roles.isEmpty()) {
            return List.of(UserRole.STUDENT);
        }
        return List.copyOf(roles);
    }

    private List<RubricDimension> validateDimensions(List<RubricDimension> dimensions) {
        if (dimensions == null || dimensions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "评价维度不能为空");
        }
        int totalWeight = dimensions.stream().mapToInt(RubricDimension::weight).sum();
        if (totalWeight != 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "评价维度权重合计必须为 100");
        }
        return dimensions.stream()
            .map(
                dimension ->
                    new RubricDimension(
                        requireText(dimension.name(), "维度名称不能为空"),
                        dimension.weight(),
                        requireText(dimension.scoringRule(), "评分细则不能为空")
                    )
            )
            .toList();
    }

    private boolean matches(String expected, String actual) {
        return expected == null || expected.isBlank() || actual.toLowerCase().contains(expected.toLowerCase());
    }

    private List<String> nullToEmpty(List<String> values) {
        return values == null ? List.of() : values;
    }

    private List<String> normalizeValues(List<String> values) {
        return nullToEmpty(values).stream()
            .map(this::trimToEmpty)
            .filter(value -> !value.isBlank())
            .toList();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String maskApiKey(String value) {
        if (!hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 6) {
            return "*".repeat(trimmed.length());
        }
        return trimmed.substring(0, 3) + "***" + trimmed.substring(trimmed.length() - 2);
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private String csv(String value) {
        String safe = value == null ? "" : value.replace("\"", "\"\"");
        if (safe.contains(",") || safe.contains("\"") || safe.contains("\n")) {
            return "\"" + safe + "\"";
        }
        return safe;
    }
}
