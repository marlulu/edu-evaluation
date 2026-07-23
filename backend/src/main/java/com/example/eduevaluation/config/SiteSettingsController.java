package com.example.eduevaluation.config;

import com.example.eduevaluation.auth.AppPrincipal;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/site")
class SiteSettingsController {

    private final SiteSettingsService service;

    SiteSettingsController(SiteSettingsService service) {
        this.service = service;
    }

    @GetMapping("/settings")
    public Map<String, String> getSettings() {
        return service.getPublicSettings();
    }

    @PutMapping("/settings")
    public Map<String, String> updateSettings(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        if (principal == null || principal.role() != com.example.eduevaluation.auth.UserRole.ADMIN) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "仅管理员可修改站点设置");
        }
        return service.updateSettings(body);
    }
}
