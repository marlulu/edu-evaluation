package com.example.eduevaluation.classroom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentRepository extends JpaRepository<StudentEntity, String> {

    List<StudentEntity> findByClassIdOrderByCreatedAtDesc(String classId);

    @Query("SELECT s FROM StudentEntity s LEFT JOIN FETCH s.studentWorks sw LEFT JOIN FETCH sw.workTask WHERE s.classId = :classId ORDER BY s.createdAt DESC")
    List<StudentEntity> findByClassIdWithWorksOrderByCreatedAtDesc(String classId);

    @Query("SELECT s FROM StudentEntity s LEFT JOIN FETCH s.studentWorks sw LEFT JOIN FETCH sw.workTask WHERE s.studentId = :studentId")
    StudentEntity findByIdWithWorks(String studentId);
}
