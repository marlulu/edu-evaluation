package com.example.eduevaluation.teaching;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CourseMemberRepository extends JpaRepository<CourseMemberEntity, String> {
    long countByCourseId(String courseId);
    void deleteByCourseId(String courseId);
    List<CourseMemberEntity> findByCourseId(String courseId);
}
