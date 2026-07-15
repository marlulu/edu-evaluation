package com.example.eduevaluation.assignment;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class AssignmentService {

    private final AssignmentRepository assignmentRepository;

    public AssignmentService(AssignmentRepository assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

    public List<AssignmentEntity> listAssignments() {
        return assignmentRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<AssignmentEntity> listActiveAssignments() {
        return assignmentRepository.findByStatusOrderByCreatedAtDesc("active");
    }

    public List<AssignmentEntity> listAssignmentsByClass(String classId) {
        return assignmentRepository.findByClassIdOrClassIdIsNullOrderByCreatedAtDesc(classId);
    }

    public AssignmentEntity getAssignment(String assignmentId) {
        return assignmentRepository.findById(assignmentId).orElse(null);
    }

    @Transactional
    public AssignmentEntity createAssignment(
            String title,
            String description,
            String criteriaText,
            String criteriaFileName,
            Set<String> classIds,
            LocalDateTime deadline
    ) {
        AssignmentEntity assignment = new AssignmentEntity(UUID.randomUUID().toString(), title, description);
        assignment.setCriteriaText(criteriaText);
        assignment.setCriteriaFileName(criteriaFileName);
        assignment.setClassIds(classIds);
        assignment.setDeadline(deadline);
        return assignmentRepository.save(assignment);
    }

    @Transactional
    public AssignmentEntity updateAssignment(
            String assignmentId,
            String title,
            String description,
            String criteriaText,
            String criteriaFileName,
            Set<String> classIds,
            LocalDateTime deadline,
            String status
    ) {
        AssignmentEntity assignment = assignmentRepository.findById(assignmentId).orElse(null);
        if (assignment == null) {
            return null;
        }

        if (title != null) {
            assignment.setTitle(title);
        }
        if (description != null) {
            assignment.setDescription(description);
        }
        if (criteriaText != null) {
            assignment.setCriteriaText(criteriaText);
        }
        if (criteriaFileName != null) {
            assignment.setCriteriaFileName(criteriaFileName);
        }
        if (classIds != null) {
            assignment.setClassIds(classIds);
        }
        if (deadline != null) {
            assignment.setDeadline(deadline);
        }
        if (status != null) {
            assignment.setStatus(status);
        }

        return assignmentRepository.save(assignment);
    }

    @Transactional
    public boolean deleteAssignment(String assignmentId) {
        if (assignmentRepository.existsById(assignmentId)) {
            assignmentRepository.deleteById(assignmentId);
            return true;
        }
        return false;
    }

    @Transactional
    public AssignmentEntity closeAssignment(String assignmentId) {
        return updateAssignment(assignmentId, null, null, null, null, null, null, "closed");
    }
}
