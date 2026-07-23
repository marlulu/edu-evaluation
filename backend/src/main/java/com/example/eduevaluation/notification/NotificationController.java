package com.example.eduevaluation.notification;

import com.example.eduevaluation.auth.AppPrincipal;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public List<NotificationService.NotificationResponse> list(
            @RequestParam(required = false, defaultValue = "false") boolean unreadOnly,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.listMy(principal, unreadOnly);
    }

    @GetMapping("/count")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal AppPrincipal principal) {
        return Map.of("count", service.unreadCount(principal));
    }

    @PostMapping("/{id}/read")
    public NotificationService.NotificationResponse markRead(
            @PathVariable String id,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.markRead(id, principal);
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal AppPrincipal principal) {
        service.markAllRead(principal);
        return ResponseEntity.ok().build();
    }
}
