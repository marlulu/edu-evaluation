package com.example.eduevaluation.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/system/services")
public class ServiceController {

    private static final Logger log = LoggerFactory.getLogger(ServiceController.class);

    // 容器名到 Docker 容器名的映射
    private static final Map<String, String> CONTAINER_NAMES = Map.of(
            "ai-worker", "edu-ai-worker",
            "backend", "edu-backend",
            "nginx", "edu-nginx",
            "mysql", "edu-mysql",
            "redis", "edu-redis",
            "minio", "edu-minio"
    );

    /**
     * 获取所有服务状态
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getServiceStatus() {
        try {
            List<Map<String, String>> services = new ArrayList<>();

            for (var entry : CONTAINER_NAMES.entrySet()) {
                Map<String, String> service = new HashMap<>();
                service.put("name", entry.getKey());
                service.put("container", entry.getValue());

                try {
                    String status = getContainerStatus(entry.getValue());
                    service.put("status", status);
                } catch (Exception e) {
                    service.put("status", "unknown");
                }

                services.add(service);
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "services", services
            ));
        } catch (Exception e) {
            log.error("Failed to get service status", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "获取服务状态失败: " + e.getMessage()));
        }
    }

    /**
     * 重启指定服务
     */
    @PostMapping("/restart/{serviceName}")
    public ResponseEntity<Map<String, Object>> restartService(@PathVariable String serviceName) {
        if (!CONTAINER_NAMES.containsKey(serviceName)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "不允许重启服务: " + serviceName));
        }

        String containerName = CONTAINER_NAMES.get(serviceName);

        try {
            log.info("Restarting service: {} (container: {})", serviceName, containerName);

            // 使用 curl 通过 Docker Socket API 重启容器
            String[] cmd = {
                    "curl", "-s", "-X", "POST",
                    "--unix-socket", "/var/run/docker.sock",
                    "http://localhost/containers/" + containerName + "/restart?t=10"
            };

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line);
            }
            int exitCode = process.waitFor();

            if (exitCode == 0) {
                log.info("Service {} restarted successfully", serviceName);
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "服务 " + serviceName + " 已重启"
                ));
            } else {
                log.error("Failed to restart service {}, exit code: {}, output: {}", serviceName, exitCode, output);
                return ResponseEntity.internalServerError()
                        .body(Map.of("success", false, "message", "重启失败: " + output.toString()));
            }
        } catch (Exception e) {
            log.error("Failed to restart service: {}", serviceName, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "重启失败: " + e.getMessage()));
        }
    }

    /**
     * 重启 AI Worker 服务（快捷方式）
     */
    @PostMapping("/restart-ai-worker")
    public ResponseEntity<Map<String, Object>> restartAiWorker() {
        return restartService("ai-worker");
    }

    /**
     * 获取容器状态
     */
    private String getContainerStatus(String containerName) throws Exception {
        String[] cmd = {
                "curl", "-s",
                "--unix-socket", "/var/run/docker.sock",
                "http://localhost/containers/" + containerName + "/json"
        };

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
        StringBuilder output = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            output.append(line);
        }
        process.waitFor();

        String json = output.toString();

        if (json.contains("\"Running\":true")) {
            return "running";
        } else if (json.contains("\"Paused\":true")) {
            return "paused";
        } else {
            return "stopped";
        }
    }
}
