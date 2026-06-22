package com.example.eduevaluation.common;

import java.io.UncheckedIOException;
import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException exception) {
        HttpStatus status = HttpStatus.valueOf(exception.getStatusCode().value());
        return ResponseEntity.status(status).body(new ApiError(status.value(), status.getReasonPhrase(), exception.getReason(), Instant.now()));
    }

    @ExceptionHandler(UncheckedIOException.class)
    public ResponseEntity<ApiError> handleIo(UncheckedIOException exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ApiError(500, "Internal Server Error", "文件保存失败", Instant.now()));
    }
}
