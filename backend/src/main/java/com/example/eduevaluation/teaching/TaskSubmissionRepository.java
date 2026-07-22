package com.example.eduevaluation.teaching;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface TaskSubmissionRepository extends JpaRepository<TaskSubmissionEntity, String> {
    Optional<TaskSubmissionEntity> findByTaskIdAndStudentId(String taskId, String studentId);
    Optional<TaskSubmissionEntity> findTopByTaskIdAndStudentIdOrderBySubmittedAtDesc(String taskId, String studentId);
    List<TaskSubmissionEntity> findByTaskIdAndStudentIdOrderBySubmittedAtDesc(String taskId, String studentId);
    List<TaskSubmissionEntity> findByStudentId(String studentId);
    List<TaskSubmissionEntity> findByTaskIdOrderBySubmittedAtDesc(String taskId);
    List<TaskSubmissionEntity> findByAnalysisJobId(String analysisJobId);
}
