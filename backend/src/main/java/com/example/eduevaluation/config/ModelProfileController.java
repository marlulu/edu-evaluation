package com.example.eduevaluation.config;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.UserRole;
import com.example.eduevaluation.common.AiWorkerClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/system/model-profiles")
public class ModelProfileController {
    private final List<Profile> profiles = new ArrayList<>();
    private final List<AuditEvent> auditEvents = new ArrayList<>();
    private final AiWorkerClient aiWorkerClient;

    public ModelProfileController(AiWorkerClient aiWorkerClient) {
        this.aiWorkerClient = aiWorkerClient;
    }

    @Value("${app.ai-worker.config-token:}")
    private String workerToken;

    @GetMapping
    public synchronized List<ProfileView> list(@AuthenticationPrincipal AppPrincipal principal) {
        requireAdmin(principal);
        return profiles.stream().map(ProfileView::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public synchronized ProfileView create(@Valid @RequestBody ProfileRequest request,
                                           @AuthenticationPrincipal AppPrincipal principal) {
        requireAdmin(principal);
        Profile profile = new Profile(UUID.randomUUID().toString(), request, false);
        profiles.add(profile);
        audit("create", profile, principal.username());
        return ProfileView.from(profile);
    }

    @PutMapping("/{id}")
    public synchronized ProfileView update(@PathVariable String id, @Valid @RequestBody ProfileRequest request,
                                           @AuthenticationPrincipal AppPrincipal principal) {
        requireAdmin(principal);
        Profile profile = find(id);
        profile.update(request);
        audit("update", profile, principal.username());
        return ProfileView.from(profile);
    }

    @PostMapping("/{id}/activate")
    public synchronized ProfileView activate(@PathVariable String id, @AuthenticationPrincipal AppPrincipal principal) {
        requireAdmin(principal);
        Profile profile = find(id);
        profiles.forEach(item -> item.active = false);
        profile.active = true;
        audit("activate", profile, principal.username());
        return ProfileView.from(profile);
    }

    @PostMapping("/{id}/test")
    public synchronized TestResult test(@PathVariable String id, @AuthenticationPrincipal AppPrincipal principal) {
        requireAdmin(principal);
        Profile profile = find(id);
        long started = System.nanoTime();
        profile.lastTestedAt = Instant.now();
        try {
            java.util.Map<String, Object> response = aiWorkerClient.testModel(java.util.Map.of(
                    "base_url", profile.baseUrl, "api_key", profile.apiKey, "model_name", profile.modelName));
            profile.lastTestSuccess = Boolean.TRUE.equals(response.get("success"));
            profile.lastTestMessage = String.valueOf(response.getOrDefault("message", "Connection test failed."));
        } catch (Exception exception) {
            profile.lastTestSuccess = false;
            profile.lastTestMessage = sanitize(exception.getMessage());
        }
        audit("test", profile, principal.username());
        return new TestResult(profile.lastTestSuccess, profile.lastTestMessage, Math.max(1, (System.nanoTime() - started) / 1_000_000), profile.lastTestedAt);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public synchronized void delete(@PathVariable String id, @AuthenticationPrincipal AppPrincipal principal) {
        requireAdmin(principal);
        Profile profile = find(id);
        if (profile.active) throw new ResponseStatusException(HttpStatus.CONFLICT, "The active model profile cannot be deleted");
        profiles.remove(profile);
        audit("delete", profile, principal.username());
    }

    @GetMapping("/internal/active")
    public synchronized RuntimeProfile activeForWorker(@RequestHeader(value = "X-AI-Worker-Token", required = false) String token) {
        if (workerToken == null || workerToken.isBlank() || !workerToken.equals(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid worker token");
        }
        Profile profile = profiles.stream().filter(item -> item.active).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No active model profile"));
        return new RuntimeProfile(profile.providerName, profile.modelName, profile.baseUrl, profile.apiKey);
    }

    @GetMapping("/audit")
    public synchronized List<AuditEvent> audit(@AuthenticationPrincipal AppPrincipal principal) {
        requireAdmin(principal);
        return List.copyOf(auditEvents);
    }

    private Profile find(String id) {
        return profiles.stream().filter(item -> item.id.equals(id)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Model profile not found"));
    }
    private void requireAdmin(AppPrincipal principal) {
        if (principal == null || principal.role() != UserRole.ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only system administrators may manage models");
    }
    private void audit(String action, Profile profile, String username) {
        auditEvents.add(0, new AuditEvent(action, profile.id, profile.providerName, profile.modelName, username, Instant.now()));
    }
    private String sanitize(String value) {
        if (value == null || value.isBlank()) return "Connection test failed.";
        return value.replaceAll("(?i)bearer\\s+\\S+", "Bearer ***").replaceAll("(?i)sk-[A-Za-z0-9_-]+", "***").substring(0, Math.min(value.length(), 300));
    }

    public record ProfileRequest(@NotBlank String providerName, String note, String website, String apiKeyHelpUrl,
                                 @NotBlank String baseUrl, @NotBlank String apiKey, @NotBlank String modelName) {}
    public record ProfileView(String id, String providerName, String note, String website, String apiKeyHelpUrl,
                              String baseUrl, String maskedApiKey, String modelName, boolean active,
                              Boolean lastTestSuccess, String lastTestMessage, Instant lastTestedAt) {
        static ProfileView from(Profile p) { return new ProfileView(p.id, p.providerName, p.note, p.website, p.apiKeyHelpUrl, p.baseUrl, mask(p.apiKey), p.modelName, p.active, p.lastTestSuccess, p.lastTestMessage, p.lastTestedAt); }
        private static String mask(String key) { return key.length() <= 6 ? "*".repeat(key.length()) : key.substring(0, 3) + "***" + key.substring(key.length() - 2); }
    }
    public record TestResult(boolean success, String message, long latencyMs, Instant testedAt) {}
    public record RuntimeProfile(String providerName, String modelName, String baseUrl, String apiKey) {}
    public record AuditEvent(String action, String profileId, String providerName, String modelName, String operator, Instant at) {}
    private static final class Profile {
        private final String id; private String providerName, note, website, apiKeyHelpUrl, baseUrl, apiKey, modelName; private boolean active;
        private Boolean lastTestSuccess; private String lastTestMessage; private Instant lastTestedAt;
        private Profile(String id, ProfileRequest r, boolean active) { this.id=id; this.active=active; update(r); }
        private void update(ProfileRequest r) { providerName=r.providerName(); note=r.note(); website=r.website(); apiKeyHelpUrl=r.apiKeyHelpUrl(); baseUrl=r.baseUrl(); apiKey=r.apiKey(); modelName=r.modelName(); }
    }
}
