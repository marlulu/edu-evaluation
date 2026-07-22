package com.example.eduevaluation.teaching;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CourseMemberRepository extends JpaRepository<CourseMemberEntity, String> {
    long countByCourseId(String courseId);
    boolean existsByCourseIdAndStudentId(String courseId, String studentId);
    void deleteByCourseId(String courseId);
    long deleteByCourseIdAndStudentId(String courseId, String studentId);
    List<CourseMemberEntity> findByCourseId(String courseId);
    List<CourseMemberEntity> findByStudentId(String studentId);
}
