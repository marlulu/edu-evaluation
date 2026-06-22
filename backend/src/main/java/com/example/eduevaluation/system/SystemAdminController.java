package com.example.eduevaluation.system;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system-admin")
public class SystemAdminController {

    private final SystemAdminService service;

    public SystemAdminController(SystemAdminService service) {
        this.service = service;
    }

    @GetMapping
    public SystemAdminSnapshot snapshot() {
        return service.snapshot();
    }

    @GetMapping("/users")
    public List<SystemUser> users() {
        return service.listUsers();
    }

    @PostMapping("/users")
    public SystemUser createUser(@RequestBody SystemUserRequest request) {
        return service.createUser(request);
    }

    @PutMapping("/users/{id}")
    public SystemUser updateUser(@PathVariable String id, @RequestBody SystemUserRequest request) {
        return service.updateUser(id, request);
    }

    @PostMapping("/users/{id}/disable")
    public SystemUser disableUser(@PathVariable String id) {
        return service.disableUser(id);
    }

    @GetMapping("/rubric-templates")
    public List<RubricTemplate> templates() {
        return service.listTemplates();
    }

    @PostMapping("/rubric-templates")
    public RubricTemplate createTemplate(@RequestBody RubricTemplateRequest request) {
        return service.createTemplate(request);
    }

    @PutMapping("/rubric-templates/{id}")
    public RubricTemplate updateTemplate(@PathVariable String id, @RequestBody RubricTemplateRequest request) {
        return service.updateTemplate(id, request);
    }

    @PostMapping("/rubric-templates/{id}/copy")
    public RubricTemplate copyTemplate(@PathVariable String id) {
        return service.copyTemplate(id);
    }

    @GetMapping("/models")
    public List<ModelConfig> models() {
        return service.listModelConfigs();
    }

    @PostMapping("/models")
    public ModelConfig createModel(@RequestBody ModelConfigRequest request) {
        return service.createModelConfig(request);
    }

    @PutMapping("/models/{id}")
    public ModelConfig updateModel(@PathVariable String id, @RequestBody ModelConfigRequest request) {
        return service.updateModelConfig(id, request);
    }

    @GetMapping("/audit-logs")
    public List<AuditLog> auditLogs(
        @RequestParam(required = false) String actor,
        @RequestParam(required = false) String action,
        @RequestParam(required = false) String objectType,
        @RequestParam(required = false) String result
    ) {
        return service.listAuditLogs(new AuditLogQuery(actor, action, objectType, result));
    }

    @GetMapping("/audit-logs/export")
    public ResponseEntity<byte[]> exportAuditLogs(
        @RequestParam(required = false) String actor,
        @RequestParam(required = false) String action,
        @RequestParam(required = false) String objectType,
        @RequestParam(required = false) String result
    ) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv;charset=UTF-8"));
        headers.setContentDisposition(
            ContentDisposition.attachment().filename("audit-logs.csv", StandardCharsets.UTF_8).build()
        );
        return ResponseEntity.ok()
            .headers(headers)
            .body(service.exportAuditLogs(new AuditLogQuery(actor, action, objectType, result)));
    }

    @GetMapping("/backups")
    public List<BackupRecord> backups() {
        return service.listBackups();
    }

    @PostMapping("/backups")
    public BackupRecord createBackup(@RequestBody BackupRequest request) {
        return service.createBackup(request);
    }

    @PostMapping("/backups/{id}/restore")
    public BackupRecord restoreBackup(
        @PathVariable String id,
        @RequestParam(required = false) String operator
    ) {
        return service.restoreBackup(id, operator);
    }
}
