package com.example.eduevaluation.auth;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface ModulePermissionRepository extends JpaRepository<ModulePermission, ModulePermission> {
    boolean existsByUserIdAndModuleNameAndPermissionName(String userId, String moduleName, ModuleAction permissionName);

    List<ModulePermission> findByUserId(String userId);

    void deleteByUserIdAndModuleName(String userId, String moduleName);
}
