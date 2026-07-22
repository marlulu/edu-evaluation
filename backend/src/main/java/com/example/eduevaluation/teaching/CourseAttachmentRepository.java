package com.example.eduevaluation.teaching;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CourseAttachmentRepository extends JpaRepository<CourseAttachmentEntity, String> {
    List<CourseAttachmentEntity> findByCourseIdOrderByFileName(String courseId);
}
