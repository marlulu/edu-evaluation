package com.example.eduevaluation.assignment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssignmentRepository extends JpaRepository<AssignmentEntity, String> {

    @Query("SELECT DISTINCT a FROM AssignmentEntity a LEFT JOIN FETCH a.classIds ORDER BY a.createdAt DESC")
    List<AssignmentEntity> findAllByOrderByCreatedAtDesc();

    @Query("""
            SELECT DISTINCT a FROM AssignmentEntity a
            LEFT JOIN FETCH a.classIds
            WHERE a.status = :status
            ORDER BY a.createdAt DESC
            """)
    List<AssignmentEntity> findByStatusOrderByCreatedAtDesc(String status);

    @Query("""
            SELECT DISTINCT a FROM AssignmentEntity a
            LEFT JOIN FETCH a.classIds
            WHERE :classId MEMBER OF a.classIds OR a.classId IS NULL
            ORDER BY a.createdAt DESC
            """)
    List<AssignmentEntity> findByClassIdOrClassIdIsNullOrderByCreatedAtDesc(String classId);
}
