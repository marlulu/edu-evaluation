package com.example.eduevaluation.assignment;

import java.util.List;

public record AssignmentImportResult(
    int imported,
    List<String> errors
) {
}

