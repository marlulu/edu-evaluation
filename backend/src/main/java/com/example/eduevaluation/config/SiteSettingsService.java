package com.example.eduevaluation.config;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class SiteSettingsService {

    private static final List<String> PUBLIC_KEYS = List.of("footer_text", "icp_filing");

    private final SiteSettingsRepository repository;

    SiteSettingsService(SiteSettingsRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Map<String, String> getPublicSettings() {
        Map<String, String> result = new LinkedHashMap<>();
        for (SiteSettingsEntity entity : repository.findBySettingKeyIn(PUBLIC_KEYS)) {
            result.put(entity.getSettingKey(), entity.getSettingValue());
        }
        return result;
    }

    @Transactional
    public Map<String, String> updateSettings(Map<String, String> updates) {
        for (Map.Entry<String, String> entry : updates.entrySet()) {
            String key = entry.getKey();
            if (!PUBLIC_KEYS.contains(key)) {
                continue;
            }
            SiteSettingsEntity entity = repository.findById(key)
                    .orElseGet(() -> new SiteSettingsEntity(key, ""));
            entity.setSettingValue(entry.getValue());
            repository.save(entity);
        }
        return getPublicSettings();
    }
}
