package com.example.eduevaluation.video;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoTaskRepository extends JpaRepository<VideoTaskEntity, String> {

    List<VideoTaskEntity> findAllByOrderByCreatedAtDesc();

    List<VideoTaskEntity> findByStatusInOrderByCreatedAtDesc(List<String> statuses);

    // 只查摘要字段，避免加载大字段 result_json
    @Query("SELECT new com.example.eduevaluation.video.VideoTaskSummary(e.taskId, e.fileName, e.status, e.progress, e.createdAt, e.updatedAt) FROM VideoTaskEntity e ORDER BY e.createdAt DESC")
    List<VideoTaskSummary> findSummaryByOrderByCreatedAtDesc();
}
