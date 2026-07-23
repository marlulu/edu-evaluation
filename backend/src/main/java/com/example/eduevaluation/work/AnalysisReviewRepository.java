package com.example.eduevaluation.work;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisReviewRepository extends JpaRepository<AnalysisReviewEntity, String> {
    Optional<AnalysisReviewEntity> findByJobId(String jobId);

    List<AnalysisReviewEntity> findByStudentIdOrderByUpdatedAtDesc(String studentId);
}
