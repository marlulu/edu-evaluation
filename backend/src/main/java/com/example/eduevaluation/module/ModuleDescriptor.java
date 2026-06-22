package com.example.eduevaluation.module;

public record ModuleDescriptor(
    String id,
    String name,
    String frontendPath,
    String backendPackage,
    String aiWorkerPath,
    String responsibility
) {
}

