package com.example.eduevaluation.classroom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassRepository extends JpaRepository<ClassEntity, String> {

    List<ClassEntity> findAllByOrderByCreatedAtDesc();

    @Query("""
            SELECT new com.example.eduevaluation.classroom.ClassSummary(
                c.classId, c.className, c.description, c.createdAt, c.updatedAt, COUNT(s.studentId)
            )
            FROM ClassEntity c
            LEFT JOIN c.students s
            GROUP BY c.classId, c.className, c.description, c.createdAt, c.updatedAt
            ORDER BY c.createdAt DESC
            """)
    List<ClassSummary> findAllSummariesOrderByCreatedAtDesc();

    @Query("SELECT c FROM ClassEntity c LEFT JOIN FETCH c.students ORDER BY c.createdAt DESC")
    List<ClassEntity> findAllWithStudentsOrderByCreatedAtDesc();
}
