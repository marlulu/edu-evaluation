package com.example.eduevaluation.config;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface SiteSettingsRepository extends JpaRepository<SiteSettingsEntity, String> {
    List<SiteSettingsEntity> findBySettingKeyIn(List<String> keys);
}
