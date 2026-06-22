package com.example.eduevaluation.evaluation;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/evaluation")
public class EvaluationController {

    private final EvaluationService service;

    public EvaluationController(EvaluationService service) {
        this.service = service;
    }

    @GetMapping
    public EvaluationSnapshot snapshot() {
        return service.snapshot();
    }

    @GetMapping("/tasks")
    public List<EvaluationTask> tasks() {
        return service.listTasks();
    }

    @GetMapping("/tasks/{id}")
    public EvaluationTask task(@PathVariable String id) {
        return service.getTask(id);
    }

    @PostMapping("/tasks")
    public EvaluationTask createTask(@RequestBody EvaluationTaskRequest request) {
        return service.createTask(request);
    }

    @PostMapping("/tasks/{id}/reviews")
    public EvaluationTask reviewTask(@PathVariable String id, @RequestBody EvaluationReviewRequest request) {
        return service.reviewTask(id, request);
    }
}
