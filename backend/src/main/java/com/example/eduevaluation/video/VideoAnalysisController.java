package com.example.eduevaluation.video;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/video")
public class VideoAnalysisController {

    private static final Logger log = LoggerFactory.getLogger(VideoAnalysisController.class);

    @Value("${app.ai-worker.base-url:http://localhost:8000}")
    private String aiWorkerBaseUrl;

    @Value("${app.upload-dir:data/uploads}")
    private String uploadDir;

    private final RestTemplate restTemplate = new RestTemplate();
    private final VideoTaskService taskService;
    private final ObjectMapper objectMapper;

    public VideoAnalysisController(VideoTaskService taskService, ObjectMapper objectMapper) {
        this.taskService = taskService;
        this.objectMapper = objectMapper;
    }

    // ====== 文件上传 ======

    @PostMapping("/upload")
    public Map<String, Object> uploadVideo(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return Map.of("success", false, "message", "文件为空");
        }

        // 验证文件类型
        String originalName = file.getOriginalFilename();
        String ext = originalName != null ? originalName.substring(originalName.lastIndexOf(".")).toLowerCase() : "";
        String[] allowedExts = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv"};
        boolean allowed = false;
        for (String e : allowedExts) {
            if (e.equals(ext)) { allowed = true; break; }
        }
        if (!allowed) {
            return Map.of("success", false, "message", "不支持的文件格式: " + ext);
        }

        // 保存文件
        String fileName = UUID.randomUUID() + ext;
        Path uploadPath = Paths.get(uploadDir, "videos");
        Files.createDirectories(uploadPath);
        Path filePath = uploadPath.resolve(fileName);
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, filePath, StandardCopyOption.REPLACE_EXISTING);
        }

        return Map.of(
            "success", true,
            "fileName", originalName,
            "filePath", filePath.toAbsolutePath().toString().replace("\\", "/"),
            "fileSize", file.getSize()
        );
    }

    // ====== 评判标准文件上传 ======

    @PostMapping("/upload-criteria")
    public Map<String, Object> uploadCriteria(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return Map.of("success", false, "message", "文件为空");
        }

        // 验证文件类型
        String originalName = file.getOriginalFilename();
        String ext = originalName != null ? originalName.substring(originalName.lastIndexOf(".")).toLowerCase() : "";
        String[] allowedExts = {".pdf", ".docx", ".doc", ".txt"};
        boolean allowed = false;
        for (String e : allowedExts) {
            if (e.equals(ext)) { allowed = true; break; }
        }
        if (!allowed) {
            return Map.of("success", false, "message", "不支持的文件格式: " + ext);
        }

        // 保存文件
        String fileName = UUID.randomUUID() + ext;
        Path uploadPath = Paths.get(uploadDir, "criteria");
        Files.createDirectories(uploadPath);
        Path filePath = uploadPath.resolve(fileName);
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, filePath, StandardCopyOption.REPLACE_EXISTING);
        }

        return Map.of(
            "success", true,
            "fileName", originalName,
            "filePath", filePath.toAbsolutePath().toString().replace("\\", "/"),
            "fileSize", file.getSize()
        );
    }

    // ====== 评判标准文件解析（转发到 AI Worker）=====

    @PostMapping("/parse-criteria")
    public ResponseEntity<Map> parseCriteria(@RequestBody Map<String, Object> request) {
        return forwardPost("/video/parse-criteria", request);
    }

    // ====== 视频分析（转发到 AI Worker + MySQL 持久化）=====

    @PostMapping("/analyze/async")
    public ResponseEntity<Map> analyzeAsync(@RequestBody Map<String, Object> request) {
        try {
            // 转发到 AI Worker
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                aiWorkerBaseUrl + "/video/analyze/async",
                HttpMethod.POST,
                entity,
                Map.class
            );

            Map<String, Object> body = response.getBody();
            if (body != null) {
                String taskId = (String) body.get("task_id");
                String fileName = (String) request.getOrDefault("fileName", request.getOrDefault("file_name", "unknown"));

                // 在 MySQL 创建记录
                taskService.saveTask(taskId, fileName, "pending", 0, null);
                log.info("Task {} saved to MySQL", taskId);
            }

            return response;
        } catch (Exception e) {
            log.error("Failed to submit task to AI Worker", e);
            return ResponseEntity.status(502).body(Map.of(
                "error", "AI Worker 连接失败",
                "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/analyze")
    public ResponseEntity<Map> analyze(@RequestBody Map<String, Object> request) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                aiWorkerBaseUrl + "/video/analyze",
                HttpMethod.POST,
                entity,
                Map.class
            );

            // 分析完成后保存到 MySQL
            Map<String, Object> body = response.getBody();
            if (body != null) {
                saveResultToMySQL(body);
            }

            return response;
        } catch (Exception e) {
            log.error("Failed to analyze video", e);
            return ResponseEntity.status(502).body(Map.of(
                "error", "AI Worker 连接失败",
                "message", e.getMessage()
            ));
        }
    }

    @GetMapping("/tasks")
    public ResponseEntity<Map> listTasks() {
        // 从 MySQL 查询任务摘要列表（不加载大字段）
        List<VideoTaskSummary> summaries = taskService.listTaskSummaries();
        List<Map<String, Object>> tasks = new ArrayList<>();

        for (VideoTaskSummary summary : summaries) {
            // 对于处理中的任务，从 AI Worker 获取最新状态
            if (!"completed".equals(summary.getStatus()) && !"failed".equals(summary.getStatus())) {
                try {
                    ResponseEntity<Map> response = restTemplate.getForEntity(
                        aiWorkerBaseUrl + "/video/tasks/" + summary.getTaskId(),
                        Map.class
                    );
                    Map<String, Object> aiTask = response.getBody();
                    if (aiTask != null) {
                        String status = (String) aiTask.get("status");
                        double progress = aiTask.get("progress") != null ? ((Number) aiTask.get("progress")).doubleValue() : 0;

                        // 更新 MySQL
                        taskService.updateProgress(summary.getTaskId(), status, progress);

                        // 如果完成，保存完整结果
                        if ("completed".equals(status) || "failed".equals(status)) {
                            try {
                                String resultJson = objectMapper.writeValueAsString(aiTask);
                                taskService.saveTask(summary.getTaskId(), summary.getFileName(), status, progress, resultJson);
                            } catch (Exception e) {
                                log.error("Failed to serialize task result", e);
                            }
                        }

                        tasks.add(Map.of(
                            "taskId", summary.getTaskId(),
                            "fileName", summary.getFileName(),
                            "status", status,
                            "progress", progress
                        ));
                        continue;
                    }
                } catch (Exception e) {
                    log.warn("Failed to get task {} from AI Worker", summary.getTaskId(), e);
                }
            }

            tasks.add(Map.of(
                "taskId", summary.getTaskId(),
                "fileName", summary.getFileName(),
                "status", summary.getStatus(),
                "progress", summary.getProgress()
            ));
        }

        return ResponseEntity.ok(Map.of("total", tasks.size(), "tasks", tasks));
    }

    @GetMapping("/tasks/{taskId}")
    public ResponseEntity<Map> getTask(@PathVariable String taskId) {
        // 优先从 MySQL 查询
        Optional<VideoTaskEntity> entity = taskService.getTask(taskId);

        if (entity.isPresent()) {
            VideoTaskEntity e = entity.get();

            // 如果任务已完成且有结果，直接返回
            if (("completed".equals(e.getStatus()) || "failed".equals(e.getStatus())) && e.getResultJson() != null) {
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> result = objectMapper.readValue(e.getResultJson(), Map.class);
                    return ResponseEntity.ok(result);
                } catch (Exception ex) {
                    log.error("Failed to deserialize task result", ex);
                }
            }
        }

        // 否则从 AI Worker 获取
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(
                aiWorkerBaseUrl + "/video/tasks/" + taskId,
                Map.class
            );
            Map<String, Object> body = response.getBody();

            // 保存到 MySQL
            if (body != null) {
                saveResultToMySQL(body);
            }

            return response;
        } catch (Exception e) {
            if (entity.isPresent()) {
                // 返回 MySQL 中的摘要信息
                return ResponseEntity.ok(Map.of(
                    "taskId", entity.get().getTaskId(),
                    "fileName", entity.get().getFileName(),
                    "status", entity.get().getStatus(),
                    "progress", entity.get().getProgress()
                ));
            }
            return ResponseEntity.status(404).body(Map.of("error", "任务不存在"));
        }
    }

    @GetMapping("/tasks/{taskId}/progress")
    public ResponseEntity<Map> getTaskProgress(@PathVariable String taskId) {
        try {
            return restTemplate.getForEntity(
                aiWorkerBaseUrl + "/video/tasks/" + taskId + "/progress",
                Map.class
            );
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of(
                "error", "AI Worker 连接失败",
                "message", e.getMessage()
            ));
        }
    }

    @DeleteMapping("/tasks/{taskId}")
    public ResponseEntity<Map> deleteTask(@PathVariable String taskId) {
        // 同时删除 MySQL 和 AI Worker
        boolean deleted = taskService.deleteTask(taskId);

        try {
            restTemplate.delete(aiWorkerBaseUrl + "/video/tasks/" + taskId);
        } catch (Exception e) {
            log.warn("Failed to delete task from AI Worker", e);
        }

        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "任务已删除", "taskId", taskId));
        }
        return ResponseEntity.status(404).body(Map.of("error", "任务不存在"));
    }

    @GetMapping("/capabilities")
    public ResponseEntity<Map> getCapabilities() {
        try {
            return restTemplate.getForEntity(aiWorkerBaseUrl + "/video/capabilities", Map.class);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of(
                "error", "AI Worker 连接失败",
                "message", e.getMessage()
            ));
        }
    }

    // ====== 音频指导（转发到 AI Worker）=====

    @PostMapping("/audio/guidance")
    public ResponseEntity<Map> audioGuidance(@RequestBody Map<String, Object> request) {
        return forwardPost("/video/audio/guidance", request);
    }

    @PostMapping("/audio/guidance/async")
    public ResponseEntity<Map> audioGuidanceAsync(@RequestBody Map<String, Object> request) {
        return forwardPost("/video/audio/guidance/async", request);
    }

    @GetMapping("/audio/guidance/tasks/{taskId}")
    public ResponseEntity<Map> getAudioGuidanceTask(@PathVariable String taskId) {
        return forwardGet("/video/audio/guidance/tasks/" + taskId);
    }

    @GetMapping("/audio/guidance/capabilities")
    public ResponseEntity<Map> getAudioGuidanceCapabilities() {
        return forwardGet("/video/audio/guidance/capabilities");
    }

    // ====== 内部方法 =====

    private void saveResultToMySQL(Map<String, Object> body) {
        try {
            String taskId = (String) body.get("task_id");
            String fileName = (String) body.getOrDefault("file_name", body.getOrDefault("fileName", "unknown"));
            String status = (String) body.get("status");
            double progress = body.get("progress") != null ? ((Number) body.get("progress")).doubleValue() : 0;

            String resultJson = objectMapper.writeValueAsString(body);
            taskService.saveTask(taskId, fileName, status, progress, resultJson);
            log.info("Task {} result saved to MySQL ({} chars)", taskId, resultJson.length());
        } catch (Exception e) {
            log.error("Failed to save task result to MySQL", e);
        }
    }

    private ResponseEntity<Map> forwardPost(String path, Map<String, Object> body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            return restTemplate.exchange(
                aiWorkerBaseUrl + path,
                HttpMethod.POST,
                entity,
                Map.class
            );
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of(
                "error", "AI Worker 连接失败",
                "message", e.getMessage()
            ));
        }
    }

    private ResponseEntity<Map> forwardGet(String path) {
        try {
            return restTemplate.exchange(
                aiWorkerBaseUrl + path,
                HttpMethod.GET,
                null,
                Map.class
            );
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of(
                "error", "AI Worker 连接失败",
                "message", e.getMessage()
            ));
        }
    }
}
