package com.example.eduevaluation.studentmanagement;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "student_groups")
class StudentGroupEntity {
    @Id private String id;
    private String name;
    protected StudentGroupEntity() {}
    StudentGroupEntity(String id, String name) { this.id = id; this.name = name; }
    String getId() { return id; }
    String getName() { return name; }
    void setName(String name) { this.name = name; }
}
