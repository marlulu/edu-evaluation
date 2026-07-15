package com.example.eduevaluation.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TeacherRegistrationRequest(
        @NotBlank(message = "请输入账号")
        @Size(max = 80, message = "账号不能超过80个字符")
        String username,
        @NotBlank(message = "请输入姓名")
        @Size(max = 100, message = "姓名不能超过100个字符")
        String displayName,
        @NotBlank(message = "请输入密码")
        @Size(min = 8, max = 100, message = "密码长度应为8至100个字符")
        String password
) {
}
