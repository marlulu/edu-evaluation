package com.example.eduevaluation.auth;

import java.io.Serializable;
import java.util.Objects;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_module_permissions")
@IdClass(ModulePermission.class)
public class ModulePermission implements Serializable {

    @Id
    private String userId;
    @Id
    private String moduleName;
    @Id
    @Enumerated(EnumType.STRING)
    private ModuleAction permissionName;

    protected ModulePermission() {
    }

    public ModulePermission(String userId, String moduleName, ModuleAction permissionName) {
        this.userId = userId;
        this.moduleName = moduleName;
        this.permissionName = permissionName;
    }

    public String getUserId() {
        return userId;
    }

    public String getModuleName() {
        return moduleName;
    }

    public ModuleAction getPermissionName() {
        return permissionName;
    }

    @Override
    public boolean equals(Object value) {
        if (!(value instanceof ModulePermission other)) {
            return false;
        }
        return Objects.equals(userId, other.userId)
                && Objects.equals(moduleName, other.moduleName)
                && permissionName == other.permissionName;
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, moduleName, permissionName);
    }
}
