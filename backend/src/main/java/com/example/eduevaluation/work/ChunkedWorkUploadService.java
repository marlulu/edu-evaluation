package com.example.eduevaluation.work;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChunkedWorkUploadService {

    private static final long MAX_PDF_SIZE = 100L * 1024 * 1024;
    private static final long MAX_CHUNK_SIZE = 5L * 1024 * 1024;
    private static final int MAX_CHUNKS = 20;

    @Value("${app.upload-dir:data/uploads}")
    private String uploadDir;

    public synchronized Map<String, Object> acceptChunk(
            MultipartFile chunk,
            String uploadId,
            String fileName,
            int chunkIndex,
            int totalChunks,
            long totalSize
    ) throws IOException {
        UUID safeUploadId = parseUploadId(uploadId);
        validate(fileName, chunkIndex, totalChunks, totalSize, chunk);

        Path chunkDirectory = Path.of(uploadDir, "chunks", safeUploadId.toString()).toAbsolutePath().normalize();
        Files.createDirectories(chunkDirectory);
        Path chunkPath = chunkDirectory.resolve(String.format("%04d.part", chunkIndex)).normalize();
        if (!chunkPath.startsWith(chunkDirectory)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "分片路径不安全。");
        }
        try (InputStream input = chunk.getInputStream()) {
            Files.copy(input, chunkPath, StandardCopyOption.REPLACE_EXISTING);
        }

        int uploadedChunks;
        try (var parts = Files.list(chunkDirectory)) {
            uploadedChunks = (int) parts.filter(path -> path.getFileName().toString().endsWith(".part")).count();
        }
        if (uploadedChunks < totalChunks) {
            return Map.of(
                    "success", true,
                    "complete", false,
                    "uploadedChunks", uploadedChunks,
                    "totalChunks", totalChunks
            );
        }

        return assemble(chunkDirectory, fileName, totalChunks, totalSize);
    }

    private Map<String, Object> assemble(
            Path chunkDirectory,
            String originalName,
            int totalChunks,
            long expectedSize
    ) throws IOException {
        Path destinationDirectory = Path.of(uploadDir, "works", "document").toAbsolutePath().normalize();
        Files.createDirectories(destinationDirectory);
        Path destination = destinationDirectory.resolve(UUID.randomUUID() + ".pdf");
        long written = 0;
        try (OutputStream output = Files.newOutputStream(destination)) {
            for (int index = 0; index < totalChunks; index++) {
                Path part = chunkDirectory.resolve(String.format("%04d.part", index));
                if (!Files.isRegularFile(part)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "PDF 分片不完整，请重新上传。");
                }
                written += Files.copy(part, output);
                if (written > MAX_PDF_SIZE) {
                    throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "PDF 文件不能超过 100 MB。");
                }
            }
        } catch (Exception exception) {
            Files.deleteIfExists(destination);
            throw exception;
        }
        if (written != expectedSize) {
            Files.deleteIfExists(destination);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "PDF 分片大小不一致，请重新上传。");
        }
        deleteChunks(chunkDirectory, totalChunks);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("complete", true);
        result.put("fileName", originalName);
        result.put("filePath", destination.toString().replace("\\", "/"));
        result.put("fileSize", written);
        result.put("fileType", "document");
        return result;
    }

    private void validate(
            String fileName,
            int chunkIndex,
            int totalChunks,
            long totalSize,
            MultipartFile chunk
    ) {
        if (fileName == null || !fileName.toLowerCase().endsWith(".pdf")) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "分片上传仅支持 PDF 文件。");
        }
        if (totalSize <= 0 || totalSize > MAX_PDF_SIZE) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "PDF 文件不能超过 100 MB。");
        }
        if (totalChunks < 1 || totalChunks > MAX_CHUNKS || chunkIndex < 0 || chunkIndex >= totalChunks) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF 分片参数无效。");
        }
        if (chunk.isEmpty() || chunk.getSize() > MAX_CHUNK_SIZE) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "单个 PDF 分片不能超过 5 MB。");
        }
    }

    private UUID parseUploadId(String uploadId) {
        try {
            return UUID.fromString(uploadId);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF 上传标识无效。");
        }
    }

    private void deleteChunks(Path chunkDirectory, int totalChunks) throws IOException {
        for (int index = 0; index < totalChunks; index++) {
            Files.deleteIfExists(chunkDirectory.resolve(String.format("%04d.part", index)));
        }
        Files.deleteIfExists(chunkDirectory);
    }
}
