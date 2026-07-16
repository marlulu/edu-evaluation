package com.example.eduevaluation.studentmanagement;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StudentAccountService {
    private final SharedStudentRepository students;

    public StudentAccountService(SharedStudentRepository students) {
        this.students = students;
    }

    @Transactional
    public StudentAccount bind(String studentNumber, String initialPassword) {
        SharedStudentEntity student = students.findByStudentNumber(studentNumber.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到对应学号"));
        if (student.getInitialPassword() == null || !student.getInitialPassword().equals(initialPassword)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "学号或初始密码不正确");
        }
        student.clearInitialPassword();
        return new StudentAccount(student.getId(), student.getStudentNumber(), student.getStudentName());
    }

    public record StudentAccount(String id, String studentNumber, String studentName) {}
}
