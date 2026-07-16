package com.example.eduevaluation.teaching;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface TaskSubmissionReviewRepository extends JpaRepository<TaskSubmissionReviewEntity, String> {
    Optional<TaskSubmissionReviewEntity> findBySubmissionId(String submissionId);
    List<TaskSubmissionReviewEntity> findBySubmissionIdIn(Collection<String> submissionIds);
}
