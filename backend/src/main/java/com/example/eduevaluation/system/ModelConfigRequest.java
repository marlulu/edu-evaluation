package com.example.eduevaluation.system;

import java.util.List;

public record ModelConfigRequest(
    String name,
    String providerType,
    String driver,
    String baseUrl,
    String defaultModel,
    String apiKey,
    ModelConfigStatus status,
    List<String> capabilities,
    String notes
) {
}
