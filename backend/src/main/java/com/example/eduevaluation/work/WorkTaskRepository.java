package com.example.eduevaluation.work;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkTaskRepository extends JpaRepository<WorkTaskEntity, String> {

    List<WorkTaskEntity> findAllByOrderByCreatedAtDesc();

    List<WorkTaskEntity> findByStatusInOrderByCreatedAtDesc(List<String> statuses);

    // 只查摘要字段，避免加载大字段 result_json
    @Query("SELECT new com.example.eduevaluation.work.WorkTaskSummary(e.taskId, e.fileName, e.status, e.progress, e.createdAt, e.updatedAt) FROM WorkTaskEntity e ORDER BY e.createdAt DESC")
    List<WorkTaskSummary> findSummaryByOrderByCreatedAtDesc();
}
