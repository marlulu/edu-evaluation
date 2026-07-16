package com.example.eduevaluation.teaching;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CourseTaskRepository extends JpaRepository<CourseTaskEntity, String> {
    List<CourseTaskEntity> findByCourseIdOrderByCreatedAtDesc(String courseId);
}
