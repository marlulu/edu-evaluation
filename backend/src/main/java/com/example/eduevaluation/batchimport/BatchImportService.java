package com.example.eduevaluation.batchimport;

import com.example.eduevaluation.assignment.AssignmentEntity;
import com.example.eduevaluation.assignment.AssignmentService;
import com.example.eduevaluation.classroom.ClassService;
import com.example.eduevaluation.classroom.StudentEntity;
import com.example.eduevaluation.classroom.StudentRepository;
import com.example.eduevaluation.common.AiWorkerClient;
import com.example.eduevaluation.work.WorkTaskService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

@Service
public class BatchImportService {

    private static final Set<String> SUPPORTING_EXTENSIONS = Set.of(".docx", ".pdf");
    private static final Set<String> WORK_EXTENSIONS = Set.of(
            ".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv", ".m4v", ".3gp",
            ".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a", ".opus",
            ".pdf", ".doc", ".docx", ".txt", ".md", ".ppt", ".pptx", ".xls", ".xlsx");
    private static final int MAX_ENTRIES_PER_ARCHIVE = 1000;
    private static final double MAX_COMPRESSION_RATIO = 200.0;
    private static final long MIN_FREE_DISK_BYTES = 1024L * 1024 * 1024;

    private final Map<String, BatchState> batches = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newFixedThreadPool(3);
    private final StudentRepository studentRepository;
    private final ClassService classService;
    private final AssignmentService assignmentService;
    private final AiWorkerClient aiWorkerClient;
    private final WorkTaskService workTaskService;

    @Value("${app.upload-dir:data/uploads}")
    private String uploadDir;

    public BatchImportService(
            StudentRepository studentRepository,
            ClassService classService,
            AssignmentService assignmentService,
            AiWorkerClient aiWorkerClient,
            WorkTaskService workTaskService) {
        this.studentRepository = studentRepository;
        this.classService = classService;
        this.assignmentService = assignmentService;
        this.aiWorkerClient = aiWorkerClient;
        this.workTaskService = workTaskService;
    }

    public Map<String, Object> preview(
            String classId, String assignmentId, MultipartFile archive) {
        requireZip(archive.getOriginalFilename());
        AssignmentEntity assignment = assignmentService.getAssignment(assignmentId);
        if (assignment == null || (!assignment.getClassIds().contains(classId)
                && !classId.equals(assignment.getClassId()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "所选作业不属于当前班级。");
        }

        String batchId = UUID.randomUUID().toString();
        Path batchDir = Path.of(uploadDir, "batch-imports", batchId).toAbsolutePath().normalize();
        Path outerZip = batchDir.resolve("batch.zip");
        try {
            Files.createDirectories(batchDir.resolve("inner"));
            archive.transferTo(outerZip);
            BatchState batch = new BatchState(batchId, classId, assignmentId, batchDir);
            inspectOuterArchive(batch, outerZip);
            batches.put(batchId, batch);
            return batch.toMap();
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    public Map<String, Object> confirm(String classId, String batchId) {
        BatchState batch = requireBatch(classId, batchId);
        synchronized (batch) {
            if (!"ready".equals(batch.status)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "该批次不能重复确认。");
            }
            batch.status = "running";
            batch.startedAt = Instant.now();
            batch.entries.stream()
                    .filter(entry -> "ready".equals(entry.status))
                    .forEach(entry -> {
                        entry.status = "waiting";
                        executor.submit(() -> executeEntry(batch, entry));
                    });
            updateBatchCompletion(batch);
        }
        return batch.toMap();
    }

    public Map<String, Object> get(String classId, String batchId) {
        return requireBatch(classId, batchId).toMap();
    }

    private void inspectOuterArchive(BatchState batch, Path outerZip) throws IOException {
        Map<String, List<EntryState>> byNumber = new HashMap<>();
        try (ZipFile zip = new ZipFile(outerZip.toFile())) {
            List<? extends ZipEntry> entries = zip.stream().toList();
            if (entries.size() > MAX_ENTRIES_PER_ARCHIVE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "压缩包条目数量过多。");
            }
            for (ZipEntry zipEntry : entries) {
                if (zipEntry.isDirectory()) {
                    continue;
                }
                String safeName = safeTopLevelName(zipEntry.getName());
                EntryState entry = parseStudentArchiveName(safeName);
                batch.entries.add(entry);
                if (!"ready".equals(entry.status)) {
                    continue;
                }
                validateCompression(zipEntry);
                requireDiskSpace(batch.batchDir, Math.max(0, zipEntry.getSize()));
                Path innerPath = batch.batchDir.resolve("inner")
                        .resolve(entry.studentNumber + "-" + entry.studentName + ".zip");
                try (InputStream input = zip.getInputStream(zipEntry)) {
                    Files.copy(input, innerPath, StandardCopyOption.REPLACE_EXISTING);
                }
                entry.innerZip = innerPath;
                inspectInnerArchive(batch, entry);
                byNumber.computeIfAbsent(entry.studentNumber, ignored -> new ArrayList<>()).add(entry);
            }
        }

        byNumber.values().stream()
                .filter(group -> group.size() > 1)
                .flatMap(List::stream)
                .forEach(entry -> entry.conflict("批次中存在重复学号。"));
        batch.entries.sort(Comparator.comparing(entry -> entry.studentNumber));
        batch.status = "ready";
    }

    private void inspectInnerArchive(BatchState batch, EntryState entry) throws IOException {
        try (ZipFile zip = new ZipFile(entry.innerZip.toFile())) {
            List<? extends ZipEntry> files = zip.stream().filter(item -> !item.isDirectory()).toList();
            if (files.size() > MAX_ENTRIES_PER_ARCHIVE) {
                entry.invalid("学生压缩包条目数量过多。");
                return;
            }
            List<String> primary = new ArrayList<>();
            List<String> supporting = new ArrayList<>();
            for (ZipEntry file : files) {
                String name = safeRelativeName(file.getName());
                validateCompression(file);
                String extension = extension(name);
                if (baseName(name).contains("作品介绍")) {
                    if (!SUPPORTING_EXTENSIONS.contains(extension)) {
                        entry.invalid("作品介绍仅支持 Word 或 PDF，未开始分析。");
                        return;
                    }
                    supporting.add(name);
                } else if (WORK_EXTENSIONS.contains(extension)) {
                    primary.add(name);
                }
            }
            if (primary.size() != 1) {
                entry.conflict(primary.isEmpty() ? "未找到主作品文件。" : "存在多个主作品文件。");
                return;
            }
            if (supporting.size() > 1) {
                entry.conflict("存在多个作品介绍文件。");
                return;
            }
            entry.primaryFile = primary.get(0);
            entry.supportingFile = supporting.isEmpty() ? null : supporting.get(0);

            List<StudentEntity> matches = studentRepository.findByClassIdAndStudentNumber(
                    batch.classId, entry.studentNumber);
            if (matches.size() > 1) {
                entry.conflict("班级中存在重复学号。");
            } else if (matches.size() == 1) {
                StudentEntity student = matches.get(0);
                entry.studentId = student.getStudentId();
                entry.willCreateStudent = false;
                if (!student.getStudentName().trim().equals(entry.studentName)) {
                    entry.conflict("学号已存在，但姓名与系统记录不一致。");
                } else if (classService.hasWorkForAssignment(student.getStudentId(), batch.assignmentId)) {
                    entry.conflict("该学生在所选作业下已有提交。");
                }
            }
        }
    }

    private void executeEntry(BatchState batch, EntryState entry) {
        Path extractDir = batch.batchDir.resolve("work").resolve(entry.studentNumber);
        try {
            entry.status = "extracting";
            Files.createDirectories(extractDir);
            extractSelected(entry.innerZip, entry.primaryFile, extractDir);
            if (entry.supportingFile != null) {
                extractSelected(entry.innerZip, entry.supportingFile, extractDir);
            }

            if (entry.studentId == null) {
                entry.status = "creating_student";
                StudentEntity student = classService.createStudent(
                        batch.classId, entry.studentName, entry.studentNumber);
                if (student == null) {
                    throw new IllegalStateException("创建学生失败。");
                }
                entry.studentId = student.getStudentId();
            }

            String supportingText = null;
            if (entry.supportingFile != null) {
                entry.status = "parsing_document";
                Path supportingPath = safeResolve(extractDir, entry.supportingFile);
                Map<String, Object> parsed = aiWorkerClient.validateDocument(
                        new FileSystemResource(supportingPath), Path.of(entry.supportingFile).getFileName().toString());
                supportingText = String.valueOf(parsed.getOrDefault("content", ""));
            }

            entry.status = "uploading";
            Path source = safeResolve(extractDir, entry.primaryFile);
            String extension = extension(entry.primaryFile);
            String fileType = fileType(extension);
            Path destinationDir = Path.of(uploadDir, "works", fileType).toAbsolutePath().normalize();
            Files.createDirectories(destinationDir);
            Path destination = destinationDir.resolve(UUID.randomUUID() + extension);
            Files.copy(source, destination, StandardCopyOption.REPLACE_EXISTING);

            AssignmentEntity assignment = assignmentService.getAssignment(batch.assignmentId);
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("filePath", destination.toString().replace("\\", "/"));
            request.put("fileName", Path.of(entry.primaryFile).getFileName().toString());
            request.put("criteriaText", assignment == null ? null : assignment.getCriteriaText());
            request.put("assignmentId", batch.assignmentId);
            request.put("options", Map.of("maxKeyframes", 12));
            if (supportingText != null) {
                request.put("supportingDocumentName",
                        Path.of(entry.supportingFile).getFileName().toString());
                request.put("supportingDocumentText", supportingText);
            }

            entry.status = "analyzing";
            Map<String, Object> response = aiWorkerClient.analyzeWorkAsync(request);
            String taskId = String.valueOf(response.get("task_id"));
            if (taskId == null || "null".equals(taskId)) {
                throw new IllegalStateException("分析服务未返回任务编号。");
            }
            workTaskService.saveTask(taskId,
                    Path.of(entry.primaryFile).getFileName().toString(),
                    fileType, "pending", 0, null);
            if (classService.addWorkToStudent(
                    entry.studentId, taskId, batch.assignmentId) == null) {
                throw new IllegalStateException("关联学生作品失败。");
            }
            entry.taskId = taskId;
            entry.status = "completed";
        } catch (Exception exception) {
            entry.status = "failed";
            entry.reason = readableMessage(exception);
        } finally {
            deleteTree(extractDir);
            updateBatchCompletion(batch);
        }
    }

    private void extractSelected(Path zipPath, String entryName, Path destination) throws IOException {
        try (ZipFile zip = new ZipFile(zipPath.toFile())) {
            ZipEntry zipEntry = zip.getEntry(entryName);
            if (zipEntry == null || zipEntry.isDirectory()) {
                throw new IOException("压缩包内文件不存在：" + entryName);
            }
            Path target = safeResolve(destination, entryName);
            requireDiskSpace(destination, Math.max(0, zipEntry.getSize()));
            Files.createDirectories(target.getParent());
            try (InputStream input = zip.getInputStream(zipEntry)) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }

    private void updateBatchCompletion(BatchState batch) {
        synchronized (batch) {
            if (!"running".equals(batch.status)) {
                return;
            }
            boolean pending = batch.entries.stream().anyMatch(entry ->
                    Set.of("waiting", "extracting", "creating_student", "parsing_document",
                            "uploading", "analyzing").contains(entry.status));
            if (!pending) {
                boolean errors = batch.entries.stream().anyMatch(entry ->
                        Set.of("conflict", "invalid", "failed").contains(entry.status));
                batch.status = errors ? "completed_with_errors" : "completed";
                batch.completedAt = Instant.now();
            }
        }
    }

    private BatchState requireBatch(String classId, String batchId) {
        BatchState batch = batches.get(batchId);
        if (batch == null || !batch.classId.equals(classId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "批量导入任务不存在。");
        }
        return batch;
    }

    private EntryState parseStudentArchiveName(String name) {
        if (!name.toLowerCase(Locale.ROOT).endsWith(".zip")) {
            return EntryState.invalid(name, "内部学生文件必须为 ZIP。");
        }
        String base = name.substring(0, name.length() - 4);
        int separator = base.indexOf('-');
        if (separator <= 0 || separator == base.length() - 1) {
            return EntryState.invalid(name, "文件名必须为“学号-姓名.zip”。");
        }
        return new EntryState(name, base.substring(0, separator).trim(),
                base.substring(separator + 1).trim());
    }

    private String safeTopLevelName(String name) {
        String safe = safeRelativeName(name);
        if (safe.contains("/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "外层 ZIP 只能包含学生 ZIP 文件。");
        }
        return safe;
    }

    private String safeRelativeName(String name) {
        String normalized = name.replace('\\', '/');
        Path path = Path.of(normalized).normalize();
        if (path.isAbsolute() || normalized.startsWith("/") || normalized.contains("../")
                || path.startsWith("..")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "压缩包包含不安全路径。");
        }
        return path.toString().replace('\\', '/');
    }

    private Path safeResolve(Path root, String relative) {
        Path resolved = root.resolve(safeRelativeName(relative)).normalize();
        if (!resolved.startsWith(root.normalize())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "压缩包包含不安全路径。");
        }
        return resolved;
    }

    private void validateCompression(ZipEntry entry) {
        if (entry.getSize() > 0 && entry.getCompressedSize() > 0
                && (double) entry.getSize() / entry.getCompressedSize() > MAX_COMPRESSION_RATIO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "压缩包膨胀比例异常。");
        }
    }

    private void requireDiskSpace(Path path, long requiredBytes) throws IOException {
        long usable = Files.getFileStore(path).getUsableSpace();
        if (usable - requiredBytes < MIN_FREE_DISK_BYTES) {
            throw new ResponseStatusException(
                    HttpStatus.INSUFFICIENT_STORAGE,
                    "磁盘剩余空间不足，已停止解压。");
        }
    }

    private void requireZip(String name) {
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".zip")) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "仅支持 ZIP 压缩包。");
        }
    }

    private String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot).toLowerCase(Locale.ROOT);
    }

    private String baseName(String name) {
        String file = Path.of(name).getFileName().toString();
        int dot = file.lastIndexOf('.');
        return dot < 0 ? file : file.substring(0, dot);
    }

    private String fileType(String extension) {
        if (Set.of(".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv", ".m4v", ".3gp")
                .contains(extension)) {
            return "video";
        }
        if (Set.of(".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a", ".opus")
                .contains(extension)) {
            return "audio";
        }
        return "document";
    }

    private String readableMessage(Exception exception) {
        Throwable current = exception;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        String message = current.getMessage();
        return message == null || message.isBlank() ? "处理失败。" : message;
    }

    private void deleteTree(Path root) {
        if (!Files.exists(root)) {
            return;
        }
        try (var paths = Files.walk(root)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // Stale batch cleanup can retry later.
                }
            });
        } catch (IOException ignored) {
            // Stale batch cleanup can retry later.
        }
    }

    private static final class BatchState {
        private final String batchId;
        private final String classId;
        private final String assignmentId;
        private final Path batchDir;
        private final List<EntryState> entries = new ArrayList<>();
        private final Instant createdAt = Instant.now();
        private volatile String status = "previewing";
        private volatile Instant startedAt;
        private volatile Instant completedAt;

        private BatchState(String batchId, String classId, String assignmentId, Path batchDir) {
            this.batchId = batchId;
            this.classId = classId;
            this.assignmentId = assignmentId;
            this.batchDir = batchDir;
        }

        private Map<String, Object> toMap() {
            Map<String, Long> counts = new LinkedHashMap<>();
            for (String state : List.of("ready", "waiting", "completed", "conflict", "invalid", "failed")) {
                counts.put(state, entries.stream().filter(entry -> state.equals(entry.status)).count());
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("batchId", batchId);
            result.put("classId", classId);
            result.put("assignmentId", assignmentId);
            result.put("status", status);
            result.put("counts", counts);
            result.put("entries", entries.stream().map(EntryState::toMap).toList());
            result.put("createdAt", createdAt);
            result.put("startedAt", startedAt);
            result.put("completedAt", completedAt);
            return result;
        }
    }

    private static final class EntryState {
        private final String archiveName;
        private final String studentNumber;
        private final String studentName;
        private volatile String status = "ready";
        private volatile String reason;
        private volatile String studentId;
        private volatile String taskId;
        private volatile boolean willCreateStudent = true;
        private Path innerZip;
        private String primaryFile;
        private String supportingFile;

        private EntryState(String archiveName, String studentNumber, String studentName) {
            this.archiveName = archiveName;
            this.studentNumber = studentNumber;
            this.studentName = studentName;
        }

        private static EntryState invalid(String archiveName, String reason) {
            EntryState entry = new EntryState(archiveName, "", "");
            entry.invalid(reason);
            return entry;
        }

        private void conflict(String message) {
            status = "conflict";
            reason = message;
        }

        private void invalid(String message) {
            status = "invalid";
            reason = message;
        }

        private Map<String, Object> toMap() {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("archiveName", archiveName);
            result.put("studentNumber", studentNumber);
            result.put("studentName", studentName);
            result.put("status", status);
            result.put("reason", reason);
            result.put("studentId", studentId);
            result.put("taskId", taskId);
            result.put("willCreateStudent", willCreateStudent);
            result.put("primaryFile", primaryFile);
            result.put("supportingFile", supportingFile);
            return result;
        }
    }
}
