package com.example.eduevaluation.assignment;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AssignmentService {

    private static final List<String> ALLOWED_EXTENSIONS = List.of(
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
        ".mp4", ".mov", ".avi", ".mkv", ".mp3", ".wav", ".m4a",
        ".zip", ".rar", ".7z", ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".md"
    );

    private final Map<String, CourseClass> classes = new ConcurrentHashMap<>();
    private final Map<String, Student> students = new ConcurrentHashMap<>();
    private final Map<String, AssignmentCategory> categories = new ConcurrentHashMap<>();
    private final Map<String, Assignment> assignments = new ConcurrentHashMap<>();
    private final Path uploadRoot = Path.of("data", "uploads");

    public AssignmentService() {
        seedDefaults();
    }

    public List<CourseClass> listClasses() {
        return classes.values().stream()
            .map(this::withStudentCount)
            .sorted(Comparator.comparing(CourseClass::createdAt))
            .toList();
    }

    public CourseClass createClass(ClassRequest request) {
        String id = UUID.randomUUID().toString();
        CourseClass courseClass = new CourseClass(
            id,
            requireText(request.name(), "班级名称不能为空"),
            trimToEmpty(request.grade()),
            trimToEmpty(request.description()),
            0,
            Instant.now()
        );
        classes.put(id, courseClass);
        return courseClass;
    }

    public CourseClass updateClass(String id, ClassRequest request) {
        CourseClass existing = requireClass(id);
        CourseClass updated = new CourseClass(
            id,
            requireText(request.name(), "班级名称不能为空"),
            trimToEmpty(request.grade()),
            trimToEmpty(request.description()),
            withStudentCount(existing).studentCount(),
            existing.createdAt()
        );
        classes.put(id, updated);
        return updated;
    }

    public void deleteClass(String id) {
        if (students.values().stream().anyMatch(student -> id.equals(student.classId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "班级下仍有学生，不能删除");
        }
        classes.remove(id);
    }

    public List<Student> listStudents() {
        return students.values().stream()
            .map(this::withClassName)
            .sorted(Comparator.comparing(Student::studentNo))
            .toList();
    }

    public Student createStudent(StudentRequest request) {
        CourseClass courseClass = requireClass(request.classId());
        String id = UUID.randomUUID().toString();
        Student student = new Student(
            id,
            requireText(request.studentNo(), "学号不能为空"),
            requireText(request.name(), "学生姓名不能为空"),
            courseClass.id(),
            courseClass.name(),
            trimToEmpty(request.email()),
            trimToEmpty(request.phone()),
            request.status() == null ? StudentStatus.ACTIVE : request.status(),
            Instant.now()
        );
        students.put(id, student);
        return student;
    }

    public Student updateStudent(String id, StudentRequest request) {
        Student existing = requireStudent(id);
        CourseClass courseClass = requireClass(request.classId());
        Student updated = new Student(
            id,
            requireText(request.studentNo(), "学号不能为空"),
            requireText(request.name(), "学生姓名不能为空"),
            courseClass.id(),
            courseClass.name(),
            trimToEmpty(request.email()),
            trimToEmpty(request.phone()),
            request.status() == null ? StudentStatus.ACTIVE : request.status(),
            existing.createdAt()
        );
        students.put(id, updated);
        return updated;
    }

    public void deleteStudent(String id) {
        students.remove(id);
    }

    public List<AssignmentCategory> listCategories() {
        return categories.values().stream()
            .sorted(Comparator.comparing(AssignmentCategory::createdAt))
            .toList();
    }

    public AssignmentCategory createCategory(CategoryRequest request) {
        String id = UUID.randomUUID().toString();
        AssignmentCategory category = new AssignmentCategory(
            id,
            requireText(request.name(), "分类名称不能为空"),
            trimToEmpty(request.description()),
            Instant.now()
        );
        categories.put(id, category);
        return category;
    }

    public AssignmentCategory updateCategory(String id, CategoryRequest request) {
        AssignmentCategory existing = requireCategory(id);
        AssignmentCategory updated = new AssignmentCategory(
            id,
            requireText(request.name(), "分类名称不能为空"),
            trimToEmpty(request.description()),
            existing.createdAt()
        );
        categories.put(id, updated);
        return updated;
    }

    public void deleteCategory(String id) {
        if (assignments.values().stream().anyMatch(assignment -> id.equals(assignment.categoryId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "分类下仍有作业，不能删除");
        }
        categories.remove(id);
    }

    public List<Assignment> listAssignments() {
        return assignments.values().stream()
            .map(this::hydrateAssignment)
            .sorted(Comparator.comparing(Assignment::updatedAt).reversed())
            .toList();
    }

    public Assignment createAssignment(AssignmentRequest request) {
        AssignmentCategory category = requireCategory(request.categoryId());
        CourseClass courseClass = requireClass(request.classId());
        Instant now = Instant.now();
        String id = UUID.randomUUID().toString();
        Assignment assignment = new Assignment(
            id,
            requireText(request.title(), "作业标题不能为空"),
            trimToEmpty(request.description()),
            category.id(),
            category.name(),
            courseClass.id(),
            courseClass.name(),
            request.status() == null ? AssignmentStatus.DRAFT : request.status(),
            trimToEmpty(request.dueAt()),
            0,
            List.of(),
            now,
            now
        );
        assignments.put(id, assignment);
        return assignment;
    }

    public Assignment updateAssignment(String id, AssignmentRequest request) {
        Assignment existing = requireAssignment(id);
        AssignmentCategory category = requireCategory(request.categoryId());
        CourseClass courseClass = requireClass(request.classId());
        Assignment updated = new Assignment(
            id,
            requireText(request.title(), "作业标题不能为空"),
            trimToEmpty(request.description()),
            category.id(),
            category.name(),
            courseClass.id(),
            courseClass.name(),
            request.status() == null ? existing.status() : request.status(),
            trimToEmpty(request.dueAt()),
            existing.currentVersion(),
            existing.versions(),
            existing.createdAt(),
            Instant.now()
        );
        assignments.put(id, updated);
        return updated;
    }

    public void deleteAssignment(String id) {
        assignments.remove(id);
    }

    public Assignment uploadVersion(String assignmentId, String studentId, String note, MultipartFile file) {
        Assignment assignment = requireAssignment(assignmentId);
        Student student = requireStudent(studentId);
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "上传文件不能为空");
        }
        String originalName = requireText(file.getOriginalFilename(), "文件名不能为空");
        validateFileName(originalName);

        int nextVersion = assignment.currentVersion() + 1;
        String versionId = UUID.randomUUID().toString();
        Path target = uploadRoot.resolve(assignmentId).resolve(versionId + "-" + originalName).normalize();
        if (!target.startsWith(uploadRoot.normalize())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "非法文件名");
        }

        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target);
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }

        AssignmentVersion version = new AssignmentVersion(
            versionId,
            assignmentId,
            nextVersion,
            student.id(),
            student.name(),
            originalName,
            file.getContentType(),
            file.getSize(),
            target.toString(),
            trimToEmpty(note),
            AssignmentStatus.SUBMITTED,
            Instant.now()
        );
        List<AssignmentVersion> versions = new ArrayList<>(assignment.versions());
        versions.add(version);
        Assignment updated = new Assignment(
            assignment.id(),
            assignment.title(),
            assignment.description(),
            assignment.categoryId(),
            assignment.categoryName(),
            assignment.classId(),
            assignment.className(),
            AssignmentStatus.SUBMITTED,
            assignment.dueAt(),
            nextVersion,
            List.copyOf(versions),
            assignment.createdAt(),
            Instant.now()
        );
        assignments.put(assignmentId, updated);
        return updated;
    }

    public AssignmentImportResult importAssignments(String csv) {
        List<String> errors = new ArrayList<>();
        String[] lines = csv.split("\\R");
        int imported = 0;
        for (int index = 0; index < lines.length; index++) {
            String line = lines[index].trim();
            if (line.isBlank() || line.startsWith("title,")) {
                continue;
            }
            String[] columns = line.split(",", -1);
            if (columns.length < 4) {
                errors.add("第 " + (index + 1) + " 行列数不足");
                continue;
            }
            try {
                String categoryId = findCategoryId(columns[2]);
                String classId = findClassId(columns[3]);
                createAssignment(new AssignmentRequest(columns[0], columns[1], categoryId, classId, AssignmentStatus.PUBLISHED, columns.length > 4 ? columns[4] : ""));
                imported++;
            } catch (RuntimeException exception) {
                errors.add("第 " + (index + 1) + " 行导入失败: " + exception.getMessage());
            }
        }
        return new AssignmentImportResult(imported, errors);
    }

    public byte[] exportAssignments() {
        String header = "title,description,category,class,status,dueAt,currentVersion\n";
        String body = listAssignments().stream()
            .map(assignment -> String.join(",",
                csv(assignment.title()),
                csv(assignment.description()),
                csv(assignment.categoryName()),
                csv(assignment.className()),
                assignment.status().name(),
                csv(assignment.dueAt()),
                Integer.toString(assignment.currentVersion())
            ))
            .collect(Collectors.joining("\n"));
        return (header + body + "\n").getBytes(StandardCharsets.UTF_8);
    }

    private void seedDefaults() {
        CourseClass classOne = new CourseClass(UUID.randomUUID().toString(), "人工智能概论 1 班", "2026", "默认演示班级", 0, Instant.now());
        classes.put(classOne.id(), classOne);
        AssignmentCategory category = new AssignmentCategory(UUID.randomUUID().toString(), "课程大作业", "默认作业分类", Instant.now());
        categories.put(category.id(), category);
        createStudent(new StudentRequest("S2026001", "示例学生", classOne.id(), "student@example.edu", "", StudentStatus.ACTIVE));
        createAssignment(new AssignmentRequest("AI 应用案例分析", "提交报告、演示材料或多媒体说明文件。", category.id(), classOne.id(), AssignmentStatus.PUBLISHED, ""));
    }

    private CourseClass requireClass(String id) {
        CourseClass courseClass = classes.get(id);
        if (courseClass == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "班级不存在");
        }
        return courseClass;
    }

    private Student requireStudent(String id) {
        Student student = students.get(id);
        if (student == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "学生不存在");
        }
        return student;
    }

    private AssignmentCategory requireCategory(String id) {
        AssignmentCategory category = categories.get(id);
        if (category == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业分类不存在");
        }
        return category;
    }

    private Assignment requireAssignment(String id) {
        Assignment assignment = assignments.get(id);
        if (assignment == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在");
        }
        return assignment;
    }

    private Assignment hydrateAssignment(Assignment assignment) {
        AssignmentCategory category = categories.get(assignment.categoryId());
        CourseClass courseClass = classes.get(assignment.classId());
        return new Assignment(
            assignment.id(),
            assignment.title(),
            assignment.description(),
            assignment.categoryId(),
            category == null ? assignment.categoryName() : category.name(),
            assignment.classId(),
            courseClass == null ? assignment.className() : courseClass.name(),
            assignment.status(),
            assignment.dueAt(),
            assignment.currentVersion(),
            assignment.versions(),
            assignment.createdAt(),
            assignment.updatedAt()
        );
    }

    private Student withClassName(Student student) {
        CourseClass courseClass = classes.get(student.classId());
        return new Student(student.id(), student.studentNo(), student.name(), student.classId(), courseClass == null ? student.className() : courseClass.name(), student.email(), student.phone(), student.status(), student.createdAt());
    }

    private CourseClass withStudentCount(CourseClass courseClass) {
        int count = (int) students.values().stream().filter(student -> courseClass.id().equals(student.classId())).count();
        return new CourseClass(courseClass.id(), courseClass.name(), courseClass.grade(), courseClass.description(), count, courseClass.createdAt());
    }

    private String findCategoryId(String nameOrId) {
        return categories.values().stream()
            .filter(category -> category.id().equals(nameOrId) || category.name().equals(nameOrId))
            .findFirst()
            .map(AssignmentCategory::id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "作业分类不存在: " + nameOrId));
    }

    private String findClassId(String nameOrId) {
        return classes.values().stream()
            .filter(courseClass -> courseClass.id().equals(nameOrId) || courseClass.name().equals(nameOrId))
            .findFirst()
            .map(CourseClass::id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "班级不存在: " + nameOrId));
    }

    private void validateFileName(String fileName) {
        String lowerName = fileName.toLowerCase();
        boolean allowed = ALLOWED_EXTENSIONS.stream().anyMatch(lowerName::endsWith);
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的文件类型");
        }
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private String csv(String value) {
        String safe = value == null ? "" : value.replace("\"", "\"\"");
        if (safe.contains(",") || safe.contains("\"") || safe.contains("\n")) {
            return "\"" + safe + "\"";
        }
        return safe;
    }
}
