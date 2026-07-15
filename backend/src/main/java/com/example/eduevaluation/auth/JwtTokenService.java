package com.example.eduevaluation.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {
    private final SecretKey key;
    private final long tokenHours;

    JwtTokenService(
            @Value("${app.auth.jwt-secret}") String secret,
            @Value("${app.auth.token-hours}") long tokenHours
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.tokenHours = tokenHours;
    }

    public IssuedToken issue(AppUser user) {
        Instant expiresAt = Instant.now().plusSeconds(tokenHours * 3600);
        String token = Jwts.builder()
                .subject(user.getId())
                .claim("role", user.getRole().name())
                .claim("username", user.getUsername())
                .claim("studentId", user.getStudentId())
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(expiresAt))
                .signWith(key)
                .compact();
        return new IssuedToken(token, expiresAt);
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public long getTokenSeconds() {
        return tokenHours * 3600;
    }

    public record IssuedToken(String value, Instant expiresAt) {
    }
}
