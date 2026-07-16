package com.example.eduevaluation.auth;

import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface UserRepository extends JpaRepository<AppUser, String> {
    Optional<AppUser> findByUsername(String username);
    List<AppUser> findByRoleIn(List<UserRole> roles);
}
