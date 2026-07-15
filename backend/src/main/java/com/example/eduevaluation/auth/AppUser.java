package com.example.eduevaluation.auth;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class AppUser {
    @Id private String id;
    @Column(nullable = false, unique = true) private String username;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(name = "display_name", nullable = false) private String displayName;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private UserRole role;
    @Column(name = "student_id") private String studentId;
    protected AppUser() {}
    AppUser(String id, String username, String passwordHash, String displayName, UserRole role) {
        this.id=id; this.username=username; this.passwordHash=passwordHash; this.displayName=displayName; this.role=role;
    }
    AppUser(String id, String username, String passwordHash, String displayName, UserRole role, String studentId) {
        this(id, username, passwordHash, displayName, role);
        this.studentId = studentId;
    }
    public String getId(){return id;} public String getUsername(){return username;}
    public String getPasswordHash(){return passwordHash;} public String getDisplayName(){return displayName;}
    public UserRole getRole(){return role;} public String getStudentId(){return studentId;}
}
