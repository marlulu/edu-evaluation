package com.example.eduevaluation.result;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/results")
public class ResultController {

    private final ResultService service;

    public ResultController(ResultService service) {
        this.service = service;
    }

    @GetMapping
    public ResultSnapshot snapshot() {
        return service.snapshot();
    }

    @GetMapping("/reports")
    public List<ResultReport> reports() {
        return service.listReports();
    }

    @PostMapping("/reports")
    public ResultReport createReport(@RequestBody ResultReportRequest request) {
        return service.createReport(request);
    }

    @PostMapping("/reports/{id}/feedback")
    public ResultReport appendFeedback(@PathVariable String id, @RequestBody FeedbackRequest request) {
        return service.appendFeedback(id, request);
    }

    @PostMapping(value = "/reports/{id}/resubmit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResultReport resubmit(
        @PathVariable String id,
        @RequestParam String studentId,
        @RequestParam(required = false) String note,
        @RequestParam MultipartFile file
    ) {
        return service.resubmit(id, studentId, note, file);
    }

    @GetMapping("/history")
    public List<ComparisonRow> history(@RequestParam String studentId) {
        return service.historyByStudent(studentId);
    }

    @GetMapping("/comparison")
    public List<ComparisonRow> comparison(@RequestParam String assignmentId) {
        return service.comparisonByAssignment(assignmentId);
    }

    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel(
        @RequestParam(required = false) String classId,
        @RequestParam(required = false) String assignmentId,
        @RequestParam(required = false) String studentId
    ) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv;charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("result-report.csv", StandardCharsets.UTF_8).build());
        return ResponseEntity.ok().headers(headers).body(service.exportBatchCsv(classId, assignmentId, studentId));
    }

    @GetMapping("/reports/{id}/pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable String id) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename("evaluation-report.pdf", StandardCharsets.UTF_8).build());
        return ResponseEntity.ok().headers(headers).body(service.exportSinglePdf(id));
    }
}

