package com.example.eduevaluation.classroom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/classes")
public class ClassController {

    private static final Logger log = LoggerFactory.getLogger(ClassController.class);

    private final ClassService classService;

    public ClassController(ClassService classService) {
        this.classService = classService;
    }

    // ====== 班级管理 ======

    @GetMapping
    public ResponseEntity<Map<String, Object>> listClasses() {
        List<ClassSummary> classes = classService.listClassSummaries();
        List<Map<String, Object>> classList = new ArrayList<>();

        for (ClassSummary cls : classes) {
            Map<String, Object> classMap = new HashMap<>();
            classMap.put("classId", cls.classId());
            classMap.put("className", cls.className());
            classMap.put("description", cls.description());
            classMap.put("createdAt", cls.createdAt());
            classMap.put("updatedAt", cls.updatedAt());
            classMap.put("studentCount", cls.studentCount());
            classList.add(classMap);
        }

        return ResponseEntity.ok(Map.of("classes", classList, "total", classList.size()));
    }

    @GetMapping("/{classId}")
    public ResponseEntity<Map<String, Object>> getClass(@PathVariable String classId) {
        ClassEntity cls = classService.getClass(classId);
        if (cls == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> classMap = new HashMap<>();
        classMap.put("classId", cls.getClassId());
        classMap.put("className", cls.getClassName());
        classMap.put("description", cls.getDescription());
        classMap.put("createdAt", cls.getCreatedAt());
        classMap.put("updatedAt", cls.getUpdatedAt());

        return ResponseEntity.ok(classMap);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createClass(@RequestBody Map<String, String> request) {
        String className = request.get("className");
        String description = request.get("description");

        if (className == null || className.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "班级名称不能为空"));
        }

        ClassEntity cls = classService.createClass(className.trim(), description);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "classId", cls.getClassId(),
                "className", cls.getClassName()
        ));
    }

    @PutMapping("/{classId}")
    public ResponseEntity<Map<String, Object>> updateClass(
            @PathVariable String classId,
            @RequestBody Map<String, String> request
    ) {
        String className = request.get("className");
        String description = request.get("description");

        ClassEntity cls = classService.updateClass(classId, className, description);
        if (cls == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "classId", cls.getClassId(),
                "className", cls.getClassName()
        ));
    }

    @DeleteMapping("/{classId}")
    public ResponseEntity<Map<String, Object>> deleteClass(@PathVariable String classId) {
        boolean deleted = classService.deleteClass(classId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ====== 学生管理 ======

    @GetMapping("/{classId}/students")
    public ResponseEntity<Map<String, Object>> listStudents(@PathVariable String classId) {
        // 验证班级存在
        if (classService.getClass(classId) == null) {
            return ResponseEntity.notFound().build();
        }

        List<StudentEntity> students = classService.listStudentsWithWorks(classId);
        List<Map<String, Object>> studentList = new ArrayList<>();

        for (StudentEntity student : students) {
            Map<String, Object> studentMap = new HashMap<>();
            studentMap.put("studentId", student.getStudentId());
            studentMap.put("studentName", student.getStudentName());
            studentMap.put("studentNumber", student.getStudentNumber());
            studentMap.put("createdAt", student.getCreatedAt());
            studentMap.put("workCount", student.getStudentWorks() == null ? 0 : student.getStudentWorks().size());
            int completedCount = 0;
            int analyzingCount = 0;
            int failedCount = 0;
            if (student.getStudentWorks() != null) {
                for (StudentWorkEntity studentWork : student.getStudentWorks()) {
                    if (studentWork.getWorkTask() == null) {
                        continue;
                    }
                    String status = studentWork.getWorkTask().getStatus();
                    if ("completed".equals(status)) {
                        completedCount++;
                    } else if ("failed".equals(status)) {
                        failedCount++;
                    } else {
                        analyzingCount++;
                    }
                }
            }
            studentMap.put("completedWorkCount", completedCount);
            studentMap.put("analyzingWorkCount", analyzingCount);
            studentMap.put("failedWorkCount", failedCount);
            studentList.add(studentMap);
        }

        return ResponseEntity.ok(Map.of("students", studentList, "total", studentList.size()));
    }

    @PostMapping("/{classId}/students")
    public ResponseEntity<Map<String, Object>> createStudent(
            @PathVariable String classId,
            @RequestBody Map<String, String> request
    ) {
        String studentName = request.get("studentName");
        String studentNumber = request.get("studentNumber");

        if (studentName == null || studentName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "学生姓名不能为空"));
        }

        StudentEntity student = classService.createStudent(classId, studentName.trim(), studentNumber);
        if (student == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "班级不存在"));
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "studentId", student.getStudentId(),
                "studentName", student.getStudentName()
        ));
    }

    // ====== 学生详情 ======

    @Transactional(readOnly = true)
    @GetMapping("/students/{studentId}")
    public ResponseEntity<Map<String, Object>> getStudent(@PathVariable String studentId) {
        StudentEntity student = classService.getStudentWithWorks(studentId);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> studentMap = new HashMap<>();
        studentMap.put("studentId", student.getStudentId());
        studentMap.put("studentName", student.getStudentName());
        studentMap.put("studentNumber", student.getStudentNumber());
        studentMap.put("classId", student.getClassId());
        studentMap.put("createdAt", student.getCreatedAt());

        // 获取关联的作品
        List<Map<String, Object>> works = new ArrayList<>();
        if (student.getStudentWorks() != null) {
            for (StudentWorkEntity sw : student.getStudentWorks()) {
                if (sw.getWorkTask() != null) {
                    Map<String, Object> workMap = new HashMap<>();
                    workMap.put("taskId", sw.getWorkTask().getTaskId());
                    workMap.put("fileName", sw.getWorkTask().getFileName());
                    workMap.put("fileType", sw.getWorkTask().getFileType());
                    workMap.put("status", sw.getWorkTask().getStatus());
                    workMap.put("progress", sw.getWorkTask().getProgress());
                    workMap.put("createdAt", sw.getCreatedAt());
                    works.add(workMap);
                }
            }
        }
        studentMap.put("works", works);
        studentMap.put("workCount", works.size());

        return ResponseEntity.ok(studentMap);
    }

    @PutMapping("/students/{studentId}")
    public ResponseEntity<Map<String, Object>> updateStudent(
            @PathVariable String studentId,
            @RequestBody Map<String, String> request
    ) {
        String studentName = request.get("studentName");
        String studentNumber = request.get("studentNumber");

        StudentEntity student = classService.updateStudent(studentId, studentName, studentNumber);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "studentId", student.getStudentId(),
                "studentName", student.getStudentName()
        ));
    }

    @DeleteMapping("/students/{studentId}")
    public ResponseEntity<Map<String, Object>> deleteStudent(@PathVariable String studentId) {
        boolean deleted = classService.deleteStudent(studentId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ====== 学生作品关联 ======

    @PostMapping("/students/{studentId}/works")
    public ResponseEntity<Map<String, Object>> addWorkToStudent(
            @PathVariable String studentId,
            @RequestBody Map<String, String> request
    ) {
        String taskId = request.get("taskId");
        String assignmentId = request.get("assignmentId");
        if (taskId == null || taskId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "任务ID不能为空"));
        }

        StudentWorkEntity studentWork = classService.addWorkToStudent(studentId, taskId, assignmentId);
        if (studentWork == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "关联失败，学生或任务不存在，或关联已存在"));
        }

        return ResponseEntity.ok(Map.of("success", true, "id", studentWork.getId()));
    }

    @DeleteMapping("/students/{studentId}/works/{taskId}")
    public ResponseEntity<Map<String, Object>> removeWorkFromStudent(
            @PathVariable String studentId,
            @PathVariable String taskId
    ) {
        boolean removed = classService.removeWorkFromStudent(studentId, taskId);
        if (!removed) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true));
    }
}
