package com.example.eduevaluation.common;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@ConfigurationProperties(prefix = "app.ai-worker")
public class AiWorkerClient {

    private String baseUrl = "http://localhost:8002";
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
