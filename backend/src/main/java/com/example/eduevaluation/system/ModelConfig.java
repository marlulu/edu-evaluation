package com.example.eduevaluation.system;

import java.time.Instant;
import java.util.List;

public record ModelConfig(
    String id,
    String name,
    String providerType,
    String driver,
    String baseUrl,
    String defaultModel,
    String apiKeyMasked,
    boolean apiKeyConfigured,
    ModelConfigStatus status,
    List<String> capabilities,
    String notes,
    Instant createdAt,
    Instant updatedAt,
    Instant lastValidatedAt
) {
}
