package com.example.eduevaluation.teaching;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface TaskSubmissionRepository extends JpaRepository<TaskSubmissionEntity, String> {
    Optional<TaskSubmissionEntity> findByTaskIdAndStudentId(String taskId, String studentId);
    List<TaskSubmissionEntity> findByStudentId(String studentId);
    List<TaskSubmissionEntity> findByTaskIdOrderBySubmittedAtDesc(String taskId);
}
