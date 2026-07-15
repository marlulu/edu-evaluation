package com.example.eduevaluation.documentvalidation;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.example.eduevaluation.common.AiWorkerClient;

@RestController
@RequestMapping("/api/document-validation")
public class DocumentValidationController {

    private static final long MAX_FILE_SIZE = 100L * 1024 * 1024;

    private final AiWorkerClient aiWorkerClient;

    public DocumentValidationController(AiWorkerClient aiWorkerClient) {
        this.aiWorkerClient = aiWorkerClient;
    }

    @PostMapping("/parse")
    public Map<String, Object> parse(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择需要解析的文档。");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "文件不能超过 100 MB。");
        }
        return aiWorkerClient.validateDocument(file);
    }
}
