package com.example.eduevaluation.teaching;

import com.example.eduevaluation.auth.AppPrincipal;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/tasks/{taskId}")
class TaskReviewController {
    private final TaskReviewService service;

    TaskReviewController(TaskReviewService service) {
        this.service = service;
    }

    @GetMapping("/detail")
    TaskReviewService.TaskDetailResponse detail(@PathVariable String taskId, @AuthenticationPrincipal AppPrincipal principal) {
        return service.detail(taskId, principal);
    }

    @PutMapping("/submission-rule")
    TaskReviewService.TaskRuleResponse updateRule(@PathVariable String taskId,
                                                   @RequestBody TaskReviewService.RuleRequest request,
                                                   @AuthenticationPrincipal AppPrincipal principal) {
        return service.updateRule(taskId, request, principal);
    }

    @PostMapping("/submission-rule/import")
    TaskReviewService.RuleImportResponse importRule(@PathVariable String taskId, @RequestParam("file") MultipartFile file,
                                                     @AuthenticationPrincipal AppPrincipal principal) {
        return service.importRule(taskId, file, principal);
    }

    @GetMapping("/submissions")
    List<TaskReviewService.SubmissionResponse> submissions(@PathVariable String taskId,
                                                           @AuthenticationPrincipal AppPrincipal principal) {
        return service.submissions(taskId, principal);
    }

    @PostMapping("/reviews/drafts")
    List<TaskReviewService.BatchReviewResult> createDrafts(@PathVariable String taskId, @RequestBody List<String> submissionIds,
                                                            @AuthenticationPrincipal AppPrincipal principal) {
        return service.createDrafts(taskId, submissionIds, principal);
    }

    @PutMapping("/submissions/{submissionId}/review")
    TaskReviewService.ReviewResponse updateReview(@PathVariable String taskId, @PathVariable String submissionId,
                                                  @RequestBody TaskReviewService.ReviewRequest request,
                                                  @AuthenticationPrincipal AppPrincipal principal) {
        return service.updateReview(taskId, submissionId, request, principal);
    }
}
