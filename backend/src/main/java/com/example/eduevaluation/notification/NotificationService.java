package com.example.eduevaluation.notification;

import com.example.eduevaluation.auth.AppPrincipal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NotificationService {

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public NotificationResponse send(String userId, String type, String title, String content, String relatedId) {
        NotificationEntity entity = new NotificationEntity(
            UUID.randomUUID().toString(), userId, type, title, content, relatedId
        );
        return toResponse(repository.save(entity));
    }

    public List<NotificationResponse> listMy(AppPrincipal principal, boolean unreadOnly) {
        List<NotificationEntity> list = unreadOnly
            ? repository.findByUserIdAndReadFalseOrderByCreatedAtDesc(principal.userId())
            : repository.findByUserIdOrderByCreatedAtDesc(principal.userId());
        return list.stream().map(this::toResponse).toList();
    }

    public long unreadCount(AppPrincipal principal) {
        return repository.countByUserIdAndReadFalse(principal.userId());
    }

    @Transactional
    public NotificationResponse markRead(String notificationId, AppPrincipal principal) {
        NotificationEntity entity = repository.findById(notificationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "通知不存在"));
        if (!entity.getUserId().equals(principal.userId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作");
        }
        entity.setRead(true);
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void markAllRead(AppPrincipal principal) {
        List<NotificationEntity> unread = repository.findByUserIdAndReadFalseOrderByCreatedAtDesc(principal.userId());
        for (NotificationEntity entity : unread) {
            entity.setRead(true);
        }
        repository.saveAll(unread);
    }

    private NotificationResponse toResponse(NotificationEntity entity) {
        return new NotificationResponse(
            entity.getId(),
            entity.getType(),
            entity.getTitle(),
            entity.getContent(),
            entity.getRelatedId(),
            entity.isRead(),
            entity.getCreatedAt().toString()
        );
    }

    public record NotificationResponse(
        String id,
        String type,
        String title,
        String content,
        String relatedId,
        boolean read,
        String createdAt
    ) {}
}
