package com.example.eduevaluation.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.Test;

class JwtTokenServiceTest {

    @Test
    void rejectsExpiredToken() {
        JwtTokenService service = new JwtTokenService(
                "this-test-secret-is-long-enough-for-hmac-signing-keys",
                -1
        );
        AppUser user = new AppUser("user-1", "teacher", "hash", "课程教师", UserRole.TEACHER);

        String token = service.issue(user).value();

        assertThatThrownBy(() -> service.parse(token))
                .isInstanceOf(ExpiredJwtException.class);
    }
}
