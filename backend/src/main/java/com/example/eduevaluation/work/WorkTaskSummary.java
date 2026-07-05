package com.example.eduevaluation.work;

import java.time.LocalDateTime;

public class WorkTaskSummary {

    private String taskId;
    private String fileName;
    private String status;
    private double progress;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public WorkTaskSummary(String taskId, String fileName, String status, double progress, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.taskId = taskId;
        this.fileName = fileName;
        this.status = status;
        this.progress = progress;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getFileName() {
        return fileName;
    }

    public String getStatus() {
        return status;
    }

    public double getProgress() {
        return progress;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
