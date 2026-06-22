package com.example.eduevaluation.evaluation;

import com.example.eduevaluation.assignment.Assignment;
import com.example.eduevaluation.assignment.AssignmentService;
import com.example.eduevaluation.assignment.AssignmentVersion;
import com.example.eduevaluation.assignment.Student;
import com.example.eduevaluation.system.RubricTemplate;
import com.example.eduevaluation.system.SystemAdminService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EvaluationService {

    private final AssignmentService assignmentService;
    private final SystemAdminService systemAdminService;
    private final ConcurrentMap<String, EvaluationTask> tasks = new ConcurrentHashMap<>();

    public EvaluationService(AssignmentService assignmentService, SystemAdminService systemAdminService) {
        this.assignmentService = assignmentService;
        this.systemAdminService = systemAdminService;
        seedDefaults();
    }

    public EvaluationSnapshot snapshot() {
        List<EvaluationTask> taskList = listTasks();
        return new EvaluationSnapshot(
            taskList,
            taskList.size(),
            taskList.stream().filter(task -> task.status() == EvaluationTaskStatus.PENDING_CONFIGURATION).count(),
            taskList.stream().filter(task -> task.status() == EvaluationTaskStatus.REVIEWED).count()
        );
    }

    public List<EvaluationTask> listTasks() {
        return tasks.values().stream()
            .sorted(Comparator.comparing(EvaluationTask::updatedAt).reversed())
            .toList();
    }

    public EvaluationTask getTask(String id) {
        return requireTask(id);
    }

    public EvaluationTask createTask(EvaluationTaskRequest request) {
        Assignment assignment = requireAssignment(request.assignmentId());
        Student student = requireStudent(request.studentId());
        AssignmentVersion version = resolveVersion(assignment, request.sourceVersionId());
        RubricTemplate rubricTemplate = requireTemplate(request.rubricTemplateId());

        List<EvaluationDimensionScore> dimensionScores = buildDimensionScores(rubricTemplate, version);
        int autoScore = dimensionScores.stream().mapToInt(EvaluationDimensionScore::score).sum();
        String scoreBand = resolveScoreBand(autoScore);
        Instant now = Instant.now();

        EvaluationTask task = new EvaluationTask(
            UUID.randomUUID().toString(),
            assignment.id(),
            assignment.title(),
            assignment.classId(),
            assignment.className(),
            student.id(),
            student.name(),
            version.id(),
            version.version(),
            rubricTemplate.id(),
            rubricTemplate.name(),
            rubricTemplate.currentVersion(),
            EvaluationTaskStatus.PENDING_CONFIGURATION,
            autoScore,
            null,
            "Placeholder evaluation result generated from rubric weights and assignment version context. Waiting for real model-backed scoring integration.",
            dimensionScores,
            buildIssues(version, scoreBand),
            buildSuggestions(scoreBand),
            List.of(),
            now,
            now
        );
        tasks.put(task.id(), task);
        return task;
    }

    public EvaluationTask reviewTask(String id, EvaluationReviewRequest request) {
        EvaluationTask existing = requireTask(id);
        int revisedScore = request.revisedScore() == null ? existing.autoScore() : request.revisedScore();
        if (revisedScore < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "修正后分数不能小于 0");
        }

        EvaluationReviewRecord reviewRecord = new EvaluationReviewRecord(
            UUID.randomUUID().toString(),
            requireText(request.reviewerId(), "复核人 ID 不能为空"),
            trimToEmpty(request.reviewerName()),
            existing.finalScore() == null ? existing.autoScore() : existing.finalScore(),
            revisedScore,
            requireText(request.reason(), "修正原因不能为空"),
            Instant.now()
        );

        List<EvaluationReviewRecord> reviewRecords = new ArrayList<>(existing.reviewRecords());
        reviewRecords.add(reviewRecord);
        EvaluationTask reviewed = new EvaluationTask(
            existing.id(),
            existing.assignmentId(),
            existing.assignmentTitle(),
            existing.classId(),
            existing.className(),
            existing.studentId(),
            existing.studentName(),
            existing.sourceVersionId(),
            existing.sourceVersionNumber(),
            existing.rubricTemplateId(),
            existing.rubricTemplateName(),
            existing.rubricVersion(),
            EvaluationTaskStatus.REVIEWED,
            existing.autoScore(),
            revisedScore,
            existing.summary(),
            existing.dimensionScores(),
            existing.issues(),
            existing.suggestions(),
            List.copyOf(reviewRecords),
            existing.createdAt(),
            Instant.now()
        );
        tasks.put(id, reviewed);
        return reviewed;
    }

    private void seedDefaults() {
        List<Assignment> assignments = assignmentService.listAssignments();
        List<Student> students = assignmentService.listStudents();
        List<RubricTemplate> templates = systemAdminService.listTemplates();
        if (assignments.isEmpty() || students.isEmpty() || templates.isEmpty()) {
            return;
        }

        Assignment assignment = assignments.get(0);
        Student student = students.get(0);
        AssignmentVersion version = assignment.versions().isEmpty()
            ? new AssignmentVersion(
                UUID.randomUUID().toString(),
                assignment.id(),
                1,
                student.id(),
                student.name(),
                "virtual-initial",
                "application/octet-stream",
                0,
                "virtual://initial",
                "initial",
                com.example.eduevaluation.assignment.AssignmentStatus.SUBMITTED,
                Instant.now()
            )
            : assignment.versions().get(assignment.versions().size() - 1);
        RubricTemplate template = templates.get(0);
        EvaluationTask seeded = createTask(new EvaluationTaskRequest(
            assignment.id(),
            student.id(),
            version.id(),
            template.id(),
            "system"
        ));
        EvaluationTask reviewed = reviewTask(
            seeded.id(),
            new EvaluationReviewRequest("teacher01", "示例教师", seeded.autoScore() - 3, "教师认为创新性表达略高于自动评分判断")
        );
        tasks.put(reviewed.id(), reviewed);
    }

    private List<EvaluationDimensionScore> buildDimensionScores(RubricTemplate rubricTemplate, AssignmentVersion version) {
        return rubricTemplate.dimensions().stream()
            .map(dimension -> {
                int maxScore = dimension.weight();
                int baseScore = Math.max(0, maxScore - Math.max(1, version.version()));
                int score = Math.min(maxScore, baseScore);
                return new EvaluationDimensionScore(
                    dimension.name(),
                    dimension.weight(),
                    maxScore,
                    score,
                    "基于评分维度权重、当前作业版本和占位规则生成的示例依据。后续将替换为可追溯的模型评分证据。"
                );
            })
            .toList();
    }

    private List<EvaluationIssue> buildIssues(AssignmentVersion version, String scoreBand) {
        List<EvaluationIssue> issues = new ArrayList<>();
        issues.add(new EvaluationIssue(
            UUID.randomUUID().toString(),
            "评分流程",
            "info",
            "自动评分能力待接入",
            "当前结果为占位评分，用于打通评价链路与复核流程。",
            "version=" + version.version()
        ));
        if ("medium".equals(scoreBand) || "low".equals(scoreBand)) {
            issues.add(new EvaluationIssue(
                UUID.randomUUID().toString(),
                "结构完整性",
                "medium",
                "建议补充更细的论证依据",
                "占位规则判定当前作业仍需加强维度间的证据支撑关系。",
                version.fileName()
            ));
        }
        return List.copyOf(issues);
    }

    private List<EvaluationSuggestion> buildSuggestions(String scoreBand) {
        List<EvaluationSuggestion> suggestions = new ArrayList<>();
        suggestions.add(new EvaluationSuggestion(
            UUID.randomUUID().toString(),
            "接入真实模型评分能力",
            "先在 AI Worker 中启用真实评价模型，再将占位评分替换为可解释的自动评分结果。",
            "all"
        ));
        if ("high".equals(scoreBand)) {
            suggestions.add(new EvaluationSuggestion(
                UUID.randomUUID().toString(),
                "强化亮点表达",
                "高分作业建议进一步明确创新点与证据之间的对应关系，提升教学示范价值。",
                "high"
            ));
        } else if ("medium".equals(scoreBand)) {
            suggestions.add(new EvaluationSuggestion(
                UUID.randomUUID().toString(),
                "补充证据与细节",
                "中分作业建议围绕关键评分维度补充论证细节、案例支撑和规范性说明。",
                "medium"
            ));
        } else {
            suggestions.add(new EvaluationSuggestion(
                UUID.randomUUID().toString(),
                "优先修正核心问题",
                "低分作业建议先修复主题偏离、结构缺失或技术实现不足等核心问题，再完善表达。",
                "low"
            ));
        }
        return List.copyOf(suggestions);
    }

    private String resolveScoreBand(int score) {
        if (score >= 85) {
            return "high";
        }
        if (score >= 70) {
            return "medium";
        }
        return "low";
    }

    private Assignment requireAssignment(String id) {
        return assignmentService.listAssignments().stream()
            .filter(assignment -> assignment.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在"));
    }

    private Student requireStudent(String id) {
        return assignmentService.listStudents().stream()
            .filter(student -> student.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "学生不存在"));
    }

    private AssignmentVersion resolveVersion(Assignment assignment, String versionId) {
        if (versionId == null || versionId.isBlank()) {
            if (assignment.versions().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前作业没有可用版本");
            }
            return assignment.versions().get(assignment.versions().size() - 1);
        }
        return assignment.versions().stream()
            .filter(version -> version.id().equals(versionId))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "作业版本不存在"));
    }

    private RubricTemplate requireTemplate(String id) {
        return systemAdminService.listTemplates().stream()
            .filter(template -> template.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "评价模板不存在"));
    }

    private EvaluationTask requireTask(String id) {
        EvaluationTask task = tasks.get(id);
        if (task == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "评价任务不存在");
        }
        return task;
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
}
