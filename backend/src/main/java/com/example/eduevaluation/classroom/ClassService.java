package com.example.eduevaluation.classroom;

import com.example.eduevaluation.work.WorkTaskEntity;
import com.example.eduevaluation.work.WorkTaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ClassService {

    private final ClassRepository classRepository;
    private final StudentRepository studentRepository;
    private final StudentWorkRepository studentWorkRepository;
    private final WorkTaskRepository workTaskRepository;

    public ClassService(
            ClassRepository classRepository,
            StudentRepository studentRepository,
            StudentWorkRepository studentWorkRepository,
            WorkTaskRepository workTaskRepository
    ) {
        this.classRepository = classRepository;
        this.studentRepository = studentRepository;
        this.studentWorkRepository = studentWorkRepository;
        this.workTaskRepository = workTaskRepository;
    }

    // ====== 班级管理 ======

    public List<ClassEntity> listClasses() {
        return classRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<ClassSummary> listClassSummaries() {
        return classRepository.findAllSummariesOrderByCreatedAtDesc();
    }

    public List<ClassEntity> listClassesWithStudents() {
        return classRepository.findAllWithStudentsOrderByCreatedAtDesc();
    }

    public ClassEntity getClass(String classId) {
        return classRepository.findById(classId).orElse(null);
    }

    @Transactional
    public ClassEntity createClass(String className, String description) {
        ClassEntity classEntity = new ClassEntity(UUID.randomUUID().toString(), className, description);
        return classRepository.save(classEntity);
    }

    @Transactional
    public ClassEntity updateClass(String classId, String className, String description) {
        ClassEntity classEntity = classRepository.findById(classId).orElse(null);
        if (classEntity == null) {
            return null;
        }
        if (className != null) {
            classEntity.setClassName(className);
        }
        if (description != null) {
            classEntity.setDescription(description);
        }
        return classRepository.save(classEntity);
    }

    @Transactional
    public boolean deleteClass(String classId) {
        if (classRepository.existsById(classId)) {
            classRepository.deleteById(classId);
            return true;
        }
        return false;
    }

    // ====== 学生管理 ======

    public List<StudentEntity> listStudents(String classId) {
        return studentRepository.findByClassIdOrderByCreatedAtDesc(classId);
    }

    public List<StudentEntity> listStudentsWithWorks(String classId) {
        return studentRepository.findByClassIdWithWorksOrderByCreatedAtDesc(classId);
    }

    public StudentEntity getStudent(String studentId) {
        return studentRepository.findById(studentId).orElse(null);
    }

    public StudentEntity getStudentWithWorks(String studentId) {
        return studentRepository.findByIdWithWorks(studentId);
    }

    @Transactional
    public StudentEntity createStudent(String classId, String studentName, String studentNumber) {
        // 验证班级存在
        if (!classRepository.existsById(classId)) {
            return null;
        }
        StudentEntity student = new StudentEntity(UUID.randomUUID().toString(), classId, studentName, studentNumber);
        return studentRepository.save(student);
    }

    @Transactional
    public StudentEntity updateStudent(String studentId, String studentName, String studentNumber) {
        StudentEntity student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return null;
        }
        if (studentName != null) {
            student.setStudentName(studentName);
        }
        if (studentNumber != null) {
            student.setStudentNumber(studentNumber);
        }
        return studentRepository.save(student);
    }

    @Transactional
    public boolean deleteStudent(String studentId) {
        if (studentRepository.existsById(studentId)) {
            studentRepository.deleteById(studentId);
            return true;
        }
        return false;
    }

    // ====== 学生作品关联 ======

    @Transactional
    public StudentWorkEntity addWorkToStudent(String studentId, String taskId) {
        return addWorkToStudent(studentId, taskId, null);
    }

    @Transactional
    public StudentWorkEntity addWorkToStudent(String studentId, String taskId, String assignmentId) {
        // 验证学生和任务存在
        if (!studentRepository.existsById(studentId) || !workTaskRepository.existsById(taskId)) {
            return null;
        }
        // 验证关联是否已存在
        if (studentWorkRepository.existsByStudentIdAndTaskId(studentId, taskId)) {
            return null;
        }
        StudentWorkEntity studentWork = new StudentWorkEntity(
                UUID.randomUUID().toString(), studentId, taskId, assignmentId);
        return studentWorkRepository.save(studentWork);
    }

    public boolean hasWorkForAssignment(String studentId, String assignmentId) {
        return assignmentId != null
                && studentWorkRepository.existsByStudentIdAndAssignmentId(studentId, assignmentId);
    }

    @Transactional
    public boolean removeWorkFromStudent(String studentId, String taskId) {
        List<StudentWorkEntity> existing = studentWorkRepository.findByTaskId(taskId);
        for (StudentWorkEntity sw : existing) {
            if (sw.getStudentId().equals(studentId)) {
                studentWorkRepository.delete(sw);
                return true;
            }
        }
        return false;
    }

    public List<StudentWorkEntity> getStudentWorks(String studentId) {
        return studentWorkRepository.findByStudentIdOrderByCreatedAtDesc(studentId);
    }

    @Transactional
    public void removeAllWorksForTask(String taskId) {
        studentWorkRepository.deleteByTaskId(taskId);
    }
}
