package com.example.eduevaluation.work;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class WorkTaskService {

    private static final Logger log = LoggerFactory.getLogger(WorkTaskService.class);

    private final WorkTaskRepository repository;

    public WorkTaskService(WorkTaskRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public WorkTaskEntity saveTask(String taskId, String fileName, String fileType, String status, double progress, String resultJson) {
        Optional<WorkTaskEntity> existing = repository.findById(taskId);
        WorkTaskEntity entity;

        if (existing.isPresent()) {
            entity = existing.get();
            entity.setStatus(status);
            entity.setProgress(progress);
            entity.setUpdatedAt(LocalDateTime.now());
            if (resultJson != null) {
                entity.setResultJson(resultJson);
            }
        } else {
            entity = new WorkTaskEntity(taskId, fileName, fileType, status, progress);
            entity.setResultJson(resultJson);
        }

        return repository.save(entity);
    }

    @Transactional
    public void updateProgress(String taskId, String status, double progress) {
        Optional<WorkTaskEntity> existing = repository.findById(taskId);
        if (existing.isPresent()) {
            WorkTaskEntity entity = existing.get();
            entity.setStatus(status);
            entity.setProgress(progress);
            entity.setUpdatedAt(LocalDateTime.now());
            repository.save(entity);
        }
    }

    public Optional<WorkTaskEntity> getTask(String taskId) {
        return repository.findById(taskId);
    }

    public List<WorkTaskEntity> listTasks() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    public List<WorkTaskSummary> listTaskSummaries() {
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

    public Map<String, Object> toSummaryMap(WorkTaskEntity entity) {
        return Map.of(
            "taskId", entity.getTaskId(),
            "fileName", entity.getFileName(),
            "status", entity.getStatus(),
            "progress", entity.getProgress()
        );
    }
}
