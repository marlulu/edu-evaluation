package com.example.eduevaluation.video;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class VideoTaskService {

    private static final Logger log = LoggerFactory.getLogger(VideoTaskService.class);

    private final VideoTaskRepository repository;

    public VideoTaskService(VideoTaskRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public VideoTaskEntity saveTask(String taskId, String fileName, String status, double progress, String resultJson) {
        Optional<VideoTaskEntity> existing = repository.findById(taskId);
        VideoTaskEntity entity;

        if (existing.isPresent()) {
            entity = existing.get();
            entity.setStatus(status);
            entity.setProgress(progress);
            entity.setUpdatedAt(LocalDateTime.now());
            if (resultJson != null) {
                entity.setResultJson(resultJson);
            }
        } else {
            entity = new VideoTaskEntity(taskId, fileName, status, progress);
            entity.setResultJson(resultJson);
        }

        return repository.save(entity);
    }

    @Transactional
    public void updateProgress(String taskId, String status, double progress) {
        Optional<VideoTaskEntity> existing = repository.findById(taskId);
        if (existing.isPresent()) {
            VideoTaskEntity entity = existing.get();
            entity.setStatus(status);
            entity.setProgress(progress);
            entity.setUpdatedAt(LocalDateTime.now());
            repository.save(entity);
        }
    }

    public Optional<VideoTaskEntity> getTask(String taskId) {
        return repository.findById(taskId);
    }

    public List<VideoTaskEntity> listTasks() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    public List<VideoTaskSummary> listTaskSummaries() {
        return repository.findSummaryByOrderByCreatedAtDesc();
    }

    @Transactional
    public boolean deleteTask(String taskId) {
        if (repository.existsById(taskId)) {
            repository.deleteById(taskId);
            return true;
        }
        return false;
    }

    public Map<String, Object> toSummaryMap(VideoTaskEntity entity) {
        return Map.of(
            "taskId", entity.getTaskId(),
            "fileName", entity.getFileName(),
            "status", entity.getStatus(),
            "progress", entity.getProgress()
        );
    }
}
