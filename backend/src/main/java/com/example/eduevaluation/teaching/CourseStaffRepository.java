package com.example.eduevaluation.teaching;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CourseStaffRepository extends JpaRepository<CourseStaffEntity, String> {
    boolean existsByCourseIdAndTeacherId(String courseId, String teacherId);
    List<CourseStaffEntity> findByCourseId(String courseId);
    List<CourseStaffEntity> findByTeacherId(String teacherId);
    void deleteByCourseId(String courseId);
}
