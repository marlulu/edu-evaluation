package com.example.eduevaluation.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.*;
import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/api/system/config")
public class SystemConfigController {

    private static final Logger log = LoggerFactory.getLogger(SystemConfigController.class);

    @Value("${app.env.path:/app/.env}")
    private String envPath;

    // 可配置的配置项白名单
    private static final Set<String> ALLOWED_KEYS = Set.of(
            "MODEL_PROVIDER_DRIVER",
            "MODEL_API_BASE_URL",
            "MODEL_API_KEY",
            "MODEL_TIMEOUT_SECONDS",
            "TEXT_PROVIDER_NAME",
            "TEXT_MODEL_NAME",
            "VISION_PROVIDER_NAME",
            "VISION_MODEL_NAME",
            "MULTIMODAL_PROVIDER_NAME",
            "MULTIMODAL_MODEL_NAME",
            "ASR_PROVIDER_NAME",
            "ASR_MODEL_NAME",
            "OCR_PROVIDER_NAME",
            "OCR_MODEL_NAME"
    );

    // 配置项分组
    private static final Map<String, List<String>> CONFIG_GROUPS = new LinkedHashMap<>() {{
        put("基础模型配置", Arrays.asList(
                "MODEL_PROVIDER_DRIVER",
                "MODEL_API_BASE_URL",
                "MODEL_API_KEY",
                "MODEL_TIMEOUT_SECONDS"
        ));
        put("文本模型", Arrays.asList(
                "TEXT_PROVIDER_NAME",
                "TEXT_MODEL_NAME"
        ));
        put("视觉模型", Arrays.asList(
                "VISION_PROVIDER_NAME",
                "VISION_MODEL_NAME"
        ));
        put("多模态模型", Arrays.asList(
                "MULTIMODAL_PROVIDER_NAME",
                "MULTIMODAL_MODEL_NAME"
        ));
        put("语音识别模型", Arrays.asList(
                "ASR_PROVIDER_NAME",
                "ASR_MODEL_NAME"
        ));
        put("OCR模型", Arrays.asList(
                "OCR_PROVIDER_NAME",
                "OCR_MODEL_NAME"
        ));
    }};

    // 配置项描述
    private static final Map<String, String> CONFIG_DESCRIPTIONS = new LinkedHashMap<>() {{
        put("MODEL_PROVIDER_DRIVER", "模型提供商驱动类型");
        put("MODEL_API_BASE_URL", "API 基础地址");
        put("MODEL_API_KEY", "API 密钥");
        put("MODEL_TIMEOUT_SECONDS", "请求超时时间（秒）");
        put("TEXT_PROVIDER_NAME", "文本模型提供商");
        put("TEXT_MODEL_NAME", "文本模型名称");
        put("VISION_PROVIDER_NAME", "视觉模型提供商");
        put("VISION_MODEL_NAME", "视觉模型名称");
        put("MULTIMODAL_PROVIDER_NAME", "多模态模型提供商");
        put("MULTIMODAL_MODEL_NAME", "多模态模型名称");
        put("ASR_PROVIDER_NAME", "语音识别提供商");
        put("ASR_MODEL_NAME", "语音识别模型名称");
        put("OCR_PROVIDER_NAME", "OCR提供商");
        put("OCR_MODEL_NAME", "OCR模型名称");
    }};

    /**
     * 获取所有配置
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getConfig() {
        try {
            Map<String, String> envVars = readEnvFile();
            Map<String, Object> result = new HashMap<>();

            // 按分组返回配置
            Map<String, List<Map<String, String>>> groups = new LinkedHashMap<>();
            for (var entry : CONFIG_GROUPS.entrySet()) {
                String groupName = entry.getKey();
                List<String> keys = entry.getValue();
                List<Map<String, String>> items = new ArrayList<>();

                for (String key : keys) {
                    Map<String, String> item = new HashMap<>();
                    item.put("key", key);
                    item.put("value", envVars.getOrDefault(key, ""));
                    item.put("description", CONFIG_DESCRIPTIONS.getOrDefault(key, ""));
                    items.add(item);
                }

                groups.put(groupName, items);
            }

            result.put("groups", groups);
            result.put("success", true);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Failed to read config", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "读取配置失败: " + e.getMessage()));
        }
    }

    /**
     * 更新配置
     */
    @PutMapping
    public ResponseEntity<Map<String, Object>> updateConfig(@RequestBody Map<String, String> updates) {
        try {
            // 验证配置项
            for (String key : updates.keySet()) {
                if (!ALLOWED_KEYS.contains(key)) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("success", false, "message", "不允许修改配置项: " + key));
                }
            }

            // 读取现有配置
            Map<String, String> envVars = readEnvFile();

            // 更新配置
            for (var entry : updates.entrySet()) {
                envVars.put(entry.getKey(), entry.getValue());
            }

            // 写入文件
            writeEnvFile(envVars);

            log.info("Updated config: {}", updates.keySet());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "配置已更新，需要重启服务才能生效"
            ));
        } catch (Exception e) {
            log.error("Failed to update config", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "更新配置失败: " + e.getMessage()));
        }
    }

    /**
     * 读取 .env 文件
     */
    private Map<String, String> readEnvFile() throws IOException {
        Map<String, String> vars = new LinkedHashMap<>();
        Path path = Paths.get(envPath);

        if (!Files.exists(path)) {
            return vars;
        }

        List<String> lines = Files.readAllLines(path);
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            int eqIndex = line.indexOf('=');
            if (eqIndex > 0) {
                String key = line.substring(0, eqIndex).trim();
                String value = line.substring(eqIndex + 1).trim();
                vars.put(key, value);
            }
        }

        return vars;
    }

    /**
     * 写入 .env 文件
     */
    private void writeEnvFile(Map<String, String> vars) throws IOException {
        Path path = Paths.get(envPath);
        List<String> lines = new ArrayList<>();

        // 读取原有文件内容（保留注释和格式）
        Map<String, Integer> keyLineMap = new HashMap<>();
        List<String> originalLines = new ArrayList<>();

        if (Files.exists(path)) {
            originalLines = Files.readAllLines(path);
            for (int i = 0; i < originalLines.size(); i++) {
                String line = originalLines.get(i).trim();
                if (!line.isEmpty() && !line.startsWith("#")) {
                    int eqIndex = line.indexOf('=');
                    if (eqIndex > 0) {
                        String key = line.substring(0, eqIndex).trim();
                        keyLineMap.put(key, i);
                    }
                }
            }
        }

        // 构建新的文件内容
        Set<String> updatedKeys = new HashSet<>();
        for (String line : originalLines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                lines.add(line);
                continue;
            }

            int eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                String key = trimmed.substring(0, eqIndex).trim();
                if (ALLOWED_KEYS.contains(key) && vars.containsKey(key)) {
                    lines.add(key + "=" + vars.get(key));
                    updatedKeys.add(key);
                } else {
                    lines.add(line);
                }
            } else {
                lines.add(line);
            }
        }

        // 添加新增的配置项
        for (var entry : vars.entrySet()) {
            if (!updatedKeys.contains(entry.getKey()) && ALLOWED_KEYS.contains(entry.getKey())) {
                lines.add(entry.getKey() + "=" + entry.getValue());
            }
        }

        // 写入文件
        Files.write(path, lines);
    }
}
