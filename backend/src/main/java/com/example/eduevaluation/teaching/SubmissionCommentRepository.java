package com.example.eduevaluation.teaching;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface SubmissionCommentRepository extends JpaRepository<SubmissionCommentEntity, String> {
    List<SubmissionCommentEntity> findByTaskIdAndStudentIdOrderByCreatedAtAsc(String taskId, String studentId);
}
