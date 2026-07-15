package com.example.eduevaluation.teaching;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CourseRepository extends JpaRepository<CourseEntity, String> {

    List<CourseEntity> findAllByOrderByUpdatedAtDesc();

    List<CourseEntity> findByStatusOrderByUpdatedAtDesc(CourseStatus status);
}
