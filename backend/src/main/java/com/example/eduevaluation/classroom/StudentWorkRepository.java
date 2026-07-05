package com.example.eduevaluation.classroom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentWorkRepository extends JpaRepository<StudentWorkEntity, String> {

    List<StudentWorkEntity> findByStudentIdOrderByCreatedAtDesc(String studentId);

    List<StudentWorkEntity> findByTaskId(String taskId);

    boolean existsByStudentIdAndTaskId(String studentId, String taskId);
}
