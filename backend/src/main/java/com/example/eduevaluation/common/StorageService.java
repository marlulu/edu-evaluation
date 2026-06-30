package com.example.eduevaluation.common;

import io.minio.*;
import io.minio.http.Method;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.concurrent.TimeUnit;

@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    private final MinioClient minioClient;
    private final StorageProperties properties;

    public StorageService(MinioClient minioClient, StorageProperties properties) {
        this.minioClient = minioClient;
        this.properties = properties;
    }

    /**
     * 上传文件到 MinIO
     *
     * @param objectName 对象名称（如 "video-keyframes/task123/frame_0001.jpg"）
     * @param inputStream 文件输入流
     * @param contentType 内容类型（如 "image/jpeg"）
     * @return 文件访问 URL
     */
    public String uploadFile(String objectName, InputStream inputStream, String contentType) {
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(properties.getBucket())
                            .object(objectName)
                            .stream(inputStream, -1, 10485760) // 10MB part size
                            .contentType(contentType)
                            .build()
            );

            String url = getFileUrl(objectName);
            log.info("文件已上传到 MinIO: {}", url);
            return url;
        } catch (Exception e) {
            log.error("上传文件到 MinIO 失败: {}", e.getMessage(), e);
            throw new RuntimeException("上传文件到 MinIO 失败", e);
        }
    }

    /**
     * 获取文件访问 URL
     *
     * @param objectName 对象名称
     * @return 文件访问 URL
     */
    public String getFileUrl(String objectName) {
        try {
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(properties.getBucket())
                            .object(objectName)
                            .expiry(7, TimeUnit.DAYS) // 7天有效期
                            .build()
            );
            return url;
        } catch (Exception e) {
            log.error("获取文件 URL 失败: {}", e.getMessage(), e);
            throw new RuntimeException("获取文件 URL 失败", e);
        }
    }

    /**
     * 删除文件
     *
     * @param objectName 对象名称
     */
    public void deleteFile(String objectName) {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(properties.getBucket())
                            .object(objectName)
                            .build()
            );
            log.info("文件已从 MinIO 删除: {}", objectName);
        } catch (Exception e) {
            log.error("删除文件失败: {}", e.getMessage(), e);
            throw new RuntimeException("删除文件失败", e);
        }
    }

    /**
     * 检查文件是否存在
     *
     * @param objectName 对象名称
     * @return 是否存在
     */
    public boolean fileExists(String objectName) {
        try {
            minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(properties.getBucket())
                            .object(objectName)
                            .build()
            );
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
