package com.example.eduevaluation.video;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoTaskRepository extends JpaRepository<VideoTaskEntity, String> {

    List<VideoTaskEntity> findAllByOrderByCreatedAtDesc();

    List<VideoTaskEntity> findByStatusInOrderByCreatedAtDesc(List<String> statuses);
}
