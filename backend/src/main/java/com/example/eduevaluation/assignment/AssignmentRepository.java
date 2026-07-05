package com.example.eduevaluation.assignment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssignmentRepository extends JpaRepository<AssignmentEntity, String> {

    List<AssignmentEntity> findAllByOrderByCreatedAtDesc();

    List<AssignmentEntity> findByStatusOrderByCreatedAtDesc(String status);

    List<AssignmentEntity> findByClassIdOrderByCreatedAtDesc(String classId);

    List<AssignmentEntity> findByClassIdOrClassIdIsNullOrderByCreatedAtDesc(String classId);
}
