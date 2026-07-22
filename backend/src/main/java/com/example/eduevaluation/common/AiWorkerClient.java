package com.example.eduevaluation.common;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

@Component
@ConfigurationProperties(prefix = "app.ai-worker")
public class AiWorkerClient {

    private String baseUrl = "http://localhost:8001";
    private String parseTaskPath = "/parse/tasks";
    private String evaluationTaskPath = "/evaluate/tasks";
    private int timeoutSeconds = 120;
    private int connectTimeoutSeconds = 10;

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(connectTimeoutSeconds));
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        return new RestTemplate(factory);
    }

    /**
     * Create a RestTemplate with longer timeout for evaluation tasks
     */
    private RestTemplate createEvaluationRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(connectTimeoutSeconds));
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds * 2));  // Double timeout for evaluation
        return new RestTemplate(factory);
    }

    public Map<String, Object> parseFiles(Map<String, Object> request) {
        RestTemplate restTemplate = createRestTemplate();
        String url = baseUrl + parseTaskPath;
        return restTemplate.postForObject(url, request, Map.class);
    }

    public Map<String, Object> evaluateSubmission(Map<String, Object> request) {
        RestTemplate restTemplate = createEvaluationRestTemplate();
        String url = baseUrl + evaluationTaskPath;
        return restTemplate.postForObject(url, request, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> validateDocument(MultipartFile file) {
        return validateDocument(file.getResource(), file.getOriginalFilename());
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> validateDocument(Resource resource, String fileName) {
        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new HttpEntity<>(resource, fileHeaders(fileName)));
        try {
            return restTemplate.postForObject(
                    baseUrl + "/document-validation/parse",
                    new HttpEntity<>(body, headers),
                    Map.class);
        } catch (HttpStatusCodeException exception) {
            throw new org.springframework.web.server.ResponseStatusException(
                    exception.getStatusCode(),
                    extractUpstreamMessage(exception.getResponseBodyAsString()),
                    exception);
        } catch (RestClientException exception) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "文档解析服务暂时不可用，请稍后重试。",
                    exception);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeWorkAsync(Map<String, Object> request) {
        return createRestTemplate().postForObject(
                baseUrl + "/analysis/manifest", request, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> testModel(Map<String, Object> request) {
        return createRestTemplate().postForObject(baseUrl + "/model-test", request, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> submitAnalysisJob(Map<String, Object> request) {
        try {
            return createRestTemplate().postForObject(baseUrl + "/analysis/jobs", request, Map.class);
        } catch (RestClientException exception) {
            throw workerUnavailable(exception);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analysisJob(String jobId) {
        try {
            return createRestTemplate().getForObject(baseUrl + "/analysis/jobs/" + jobId, Map.class);
        } catch (HttpStatusCodeException exception) {
            throw new ResponseStatusException(exception.getStatusCode(),
                    extractUpstreamMessage(exception.getResponseBodyAsString()), exception);
        } catch (RestClientException exception) {
            throw workerUnavailable(exception);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> cancelAnalysisJob(String jobId) {
        try {
            return createRestTemplate().exchange(
                    baseUrl + "/analysis/jobs/" + jobId,
                    HttpMethod.DELETE,
                    HttpEntity.EMPTY,
                    Map.class).getBody();
        } catch (HttpStatusCodeException exception) {
            throw new ResponseStatusException(exception.getStatusCode(),
                    extractUpstreamMessage(exception.getResponseBodyAsString()), exception);
        } catch (RestClientException exception) {
            throw workerUnavailable(exception);
        }
    }

    private ResponseStatusException workerUnavailable(RestClientException exception) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "AI 分析服务暂不可用，请确认 AI Worker 已在 http://localhost:8001 启动后重试", exception);
    }

    private HttpHeaders fileHeaders(String fileName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDispositionFormData("file", fileName);
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        return headers;
    }

    private String extractUpstreamMessage(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "文档解析服务请求失败。";
        }
        try {
            com.fasterxml.jackson.databind.JsonNode detail =
                    new com.fasterxml.jackson.databind.ObjectMapper().readTree(responseBody).path("detail");
            if (detail.isTextual()) {
                return detail.asText();
            }
            if (detail.hasNonNull("message")) {
                return detail.path("message").asText();
            }
            if (detail.isArray() && !detail.isEmpty() && detail.get(0).hasNonNull("msg")) {
                return detail.get(0).path("msg").asText();
            }
        } catch (com.fasterxml.jackson.core.JsonProcessingException ignored) {
            // Fall back to a stable localized message.
        }
        return "文档解析服务请求失败。";
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getParseTaskPath() {
        return parseTaskPath;
    }

    public void setParseTaskPath(String parseTaskPath) {
        this.parseTaskPath = parseTaskPath;
    }

    public String getEvaluationTaskPath() {
        return evaluationTaskPath;
    }

    public void setEvaluationTaskPath(String evaluationTaskPath) {
        this.evaluationTaskPath = evaluationTaskPath;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public int getConnectTimeoutSeconds() {
        return connectTimeoutSeconds;
    }

    public void setConnectTimeoutSeconds(int connectTimeoutSeconds) {
        this.connectTimeoutSeconds = connectTimeoutSeconds;
    }
}
