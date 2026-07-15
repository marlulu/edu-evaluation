package com.example.eduevaluation.assignment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/assignments")
public class AssignmentController {

    private static final Logger log = LoggerFactory.getLogger(AssignmentController.class);

    private final AssignmentService assignmentService;

    public AssignmentController(AssignmentService assignmentService) {
        this.assignmentService = assignmentService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listAssignments(
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String status
    ) {
        List<AssignmentEntity> assignments;

        if (classId != null && !classId.isEmpty()) {
            assignments = assignmentService.listAssignmentsByClass(classId);
        } else if ("active".equals(status)) {
            assignments = assignmentService.listActiveAssignments();
        } else {
            assignments = assignmentService.listAssignments();
        }

        List<Map<String, Object>> assignmentList = new ArrayList<>();
        for (AssignmentEntity a : assignments) {
            Map<String, Object> map = new HashMap<>();
            map.put("assignmentId", a.getAssignmentId());
            map.put("title", a.getTitle());
            map.put("description", a.getDescription());
            map.put("criteriaText", a.getCriteriaText());
            map.put("criteriaFileName", a.getCriteriaFileName());
            map.put("classIds", a.getClassIds());
            map.put("classId", a.getClassId());
            map.put("deadline", a.getDeadline());
            map.put("status", a.getStatus());
            map.put("createdAt", a.getCreatedAt());
            map.put("updatedAt", a.getUpdatedAt());
            assignmentList.add(map);
        }

        return ResponseEntity.ok(Map.of("assignments", assignmentList, "total", assignmentList.size()));
    }

    @GetMapping("/{assignmentId}")
    public ResponseEntity<Map<String, Object>> getAssignment(@PathVariable String assignmentId) {
        AssignmentEntity a = assignmentService.getAssignment(assignmentId);
        if (a == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> map = new HashMap<>();
        map.put("assignmentId", a.getAssignmentId());
        map.put("title", a.getTitle());
        map.put("description", a.getDescription());
        map.put("criteriaText", a.getCriteriaText());
        map.put("criteriaFileName", a.getCriteriaFileName());
        map.put("classIds", a.getClassIds());
        map.put("classId", a.getClassId());
        map.put("deadline", a.getDeadline());
        map.put("status", a.getStatus());
        map.put("createdAt", a.getCreatedAt());
        map.put("updatedAt", a.getUpdatedAt());

        return ResponseEntity.ok(map);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createAssignment(@RequestBody Map<String, Object> request) {
        String title = (String) request.get("title");
        String description = (String) request.get("description");
        String criteriaText = (String) request.get("criteriaText");
        String criteriaFileName = (String) request.get("criteriaFileName");
        Set<String> classIds = classIds(request);

        if (title == null || title.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "任务标题不能为空"));
        }

        LocalDateTime deadline = null;
        if (request.get("deadline") != null) {
            try {
                deadline = LocalDateTime.parse((String) request.get("deadline"), DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception e) {
                log.warn("Failed to parse deadline: {}", request.get("deadline"));
            }
        }

        AssignmentEntity assignment = assignmentService.createAssignment(
                title.trim(),
                description,
                criteriaText,
                criteriaFileName,
                classIds,
                deadline
        );

        return ResponseEntity.ok(Map.of(
                "success", true,
                "assignmentId", assignment.getAssignmentId(),
                "title", assignment.getTitle()
        ));
    }

    @PutMapping("/{assignmentId}")
    public ResponseEntity<Map<String, Object>> updateAssignment(
            @PathVariable String assignmentId,
            @RequestBody Map<String, Object> request
    ) {
        String title = (String) request.get("title");
        String description = (String) request.get("description");
        String criteriaText = (String) request.get("criteriaText");
        String criteriaFileName = (String) request.get("criteriaFileName");
        Set<String> classIds = request.containsKey("classIds") || request.containsKey("classId")
                ? classIds(request) : null;
        String status = (String) request.get("status");

        LocalDateTime deadline = null;
        if (request.get("deadline") != null) {
            try {
                deadline = LocalDateTime.parse((String) request.get("deadline"), DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception e) {
                log.warn("Failed to parse deadline: {}", request.get("deadline"));
            }
        }

        AssignmentEntity assignment = assignmentService.updateAssignment(
                assignmentId,
                title,
                description,
                criteriaText,
                criteriaFileName,
                classIds,
                deadline,
                status
        );

        if (assignment == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "assignmentId", assignment.getAssignmentId(),
                "title", assignment.getTitle()
        ));
    }

    @DeleteMapping("/{assignmentId}")
    public ResponseEntity<Map<String, Object>> deleteAssignment(@PathVariable String assignmentId) {
        boolean deleted = assignmentService.deleteAssignment(assignmentId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/{assignmentId}/close")
    public ResponseEntity<Map<String, Object>> closeAssignment(@PathVariable String assignmentId) {
        AssignmentEntity assignment = assignmentService.closeAssignment(assignmentId);
        if (assignment == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true, "status", assignment.getStatus()));
    }

    private Set<String> classIds(Map<String, Object> request) {
        Set<String> result = new LinkedHashSet<>();
        Object raw = request.get("classIds");
        if (raw instanceof Collection<?> values) {
            values.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .forEach(result::add);
        }
        Object legacy = request.get("classId");
        if (legacy instanceof String value && !value.isBlank()) {
            result.add(value.trim());
        }
        return result;
    }
}
