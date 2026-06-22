package com.example.eduevaluation.result;

import com.example.eduevaluation.assignment.Assignment;
import com.example.eduevaluation.assignment.AssignmentService;
import com.example.eduevaluation.assignment.AssignmentVersion;
import com.example.eduevaluation.assignment.CourseClass;
import com.example.eduevaluation.assignment.Student;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.DoubleSummaryStatistics;
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
public class ResultService {

    private final AssignmentService assignmentService;
    private final Map<String, ResultReport> reports = new ConcurrentHashMap<>();

    public ResultService(AssignmentService assignmentService) {
        this.assignmentService = assignmentService;
        seedDefaults();
    }

    public ResultSnapshot snapshot() {
        List<ResultReport> reportList = listReports();
        return new ResultSnapshot(
            reportList,
            buildClassAverages(reportList),
            buildStudentHistory(reportList),
            buildClassComparison(reportList)
        );
    }

    public List<ResultReport> listReports() {
        return reports.values().stream()
            .sorted(Comparator.comparing(ResultReport::releasedAt).reversed())
            .toList();
    }

    public ResultReport createReport(ResultReportRequest request) {
        Assignment assignment = requireAssignment(request.assignmentId());
        Student student = requireStudent(request.studentId());
        AssignmentVersion version = resolveVersion(assignment, request.sourceVersionId());
        List<DimensionScore> dimensions = validateDimensions(request.dimensions());
        int overallScore = dimensions.stream().mapToInt(DimensionScore::score).sum();
        FeedbackLoopEntry released = new FeedbackLoopEntry(
            UUID.randomUUID().toString(),
            FeedbackActionType.SCORE_RELEASE,
            requireText(request.evaluator(), "评价人不能为空"),
            "评分结果已发布",
            version.id(),
            version.id(),
            Instant.now()
        );
        ResultReport report = new ResultReport(
            UUID.randomUUID().toString(),
            assignment.id(),
            assignment.title(),
            assignment.classId(),
            assignment.className(),
            student.id(),
            student.name(),
            version.id(),
            version.version(),
            overallScore,
            dimensions,
            normalizeTextList(request.strengths()),
            normalizeTextList(request.weaknesses()),
            normalizeTextList(request.suggestions()),
            requireText(request.evaluator(), "评价人不能为空"),
            trimToEmpty(request.teacherSummary()),
            Instant.now(),
            List.of(released)
        );
        reports.put(report.id(), report);
        return report;
    }

    public ResultReport appendFeedback(String reportId, FeedbackRequest request) {
        ResultReport existing = requireReport(reportId);
        FeedbackLoopEntry entry = new FeedbackLoopEntry(
            UUID.randomUUID().toString(),
            FeedbackActionType.FEEDBACK_APPEND,
            requireText(request.actor(), "操作人不能为空"),
            requireText(request.comment(), "反馈内容不能为空"),
            existing.sourceVersionId(),
            existing.sourceVersionId(),
            Instant.now()
        );
        ResultReport updated = withFeedback(existing, entry);
        reports.put(reportId, updated);
        return updated;
    }

    public ResultReport resubmit(String reportId, String studentId, String note, MultipartFile file) {
        ResultReport existing = requireReport(reportId);
        Assignment assignment = requireAssignment(existing.assignmentId());
        Assignment updatedAssignment = assignmentService.uploadVersion(assignment.id(), studentId, note, file);
        AssignmentVersion latestVersion = updatedAssignment.versions().get(updatedAssignment.versions().size() - 1);
        FeedbackLoopEntry entry = new FeedbackLoopEntry(
            UUID.randomUUID().toString(),
            FeedbackActionType.STUDENT_RESUBMIT,
            "student:" + studentId,
            trimToEmpty(note).isBlank() ? "学生已提交新版本作业" : note.trim(),
            existing.sourceVersionId(),
            latestVersion.id(),
            Instant.now()
        );
        ResultReport updated = withFeedback(existing, entry);
        reports.put(reportId, updated);
        return updated;
    }

    public List<ComparisonRow> historyByStudent(String studentId) {
        return listReports().stream()
            .filter(report -> report.studentId().equals(studentId))
            .map(report -> new ComparisonRow(report.assignmentTitle(), report.overallScore(), report.sourceVersionNumber(), report.className(), report.studentName()))
            .toList();
    }

    public List<ComparisonRow> comparisonByAssignment(String assignmentId) {
        return listReports().stream()
            .filter(report -> report.assignmentId().equals(assignmentId))
            .map(report -> new ComparisonRow(report.assignmentTitle(), report.overallScore(), report.sourceVersionNumber(), report.className(), report.studentName()))
            .toList();
    }

    public byte[] exportBatchCsv(String classId, String assignmentId, String studentId) {
        String header = "assignment,student,class,version,overallScore,releasedAt,evaluator\n";
        String body = filterReports(classId, assignmentId, studentId).stream()
            .map(report -> String.join(",",
                csv(report.assignmentTitle()),
                csv(report.studentName()),
                csv(report.className()),
                Integer.toString(report.sourceVersionNumber()),
                Integer.toString(report.overallScore()),
                report.releasedAt().toString(),
                csv(report.evaluator())
            ))
            .collect(Collectors.joining("\n"));
        return (header + body + "\n").getBytes(StandardCharsets.UTF_8);
    }

    public byte[] exportSinglePdf(String reportId) {
        return SimplePdfExporter.export(requireReport(reportId));
    }

    private void seedDefaults() {
        List<Assignment> assignments = assignmentService.listAssignments();
        List<Student> students = assignmentService.listStudents();
        if (assignments.isEmpty() || students.isEmpty()) {
            return;
        }
        Assignment assignment = assignments.get(0);
        Student student = students.get(0);
        AssignmentVersion sourceVersion;
        if (assignment.versions().isEmpty()) {
            sourceVersion = new AssignmentVersion(
                UUID.randomUUID().toString(),
                assignment.id(),
                1,
                student.id(),
                student.name(),
                "initial-submission.pdf",
                "application/pdf",
                0,
                "virtual://initial-submission.pdf",
                "演示初始提交",
                com.example.eduevaluation.assignment.AssignmentStatus.SUBMITTED,
                Instant.now()
            );
        } else {
            sourceVersion = assignment.versions().get(assignment.versions().size() - 1);
        }
        List<DimensionScore> dimensions = List.of(
            new DimensionScore("AI 概念准确性", 22, 25, "核心概念准确，术语基本清晰。"),
            new DimensionScore("算法理解", 20, 25, "算法流程描述完整，但局限性分析偏少。"),
            new DimensionScore("案例分析", 16, 20, "案例与课程内容关联较强。"),
            new DimensionScore("结构表达", 24, 30, "结构完整，修改建议可进一步收敛论证。")
        );
        FeedbackLoopEntry feedback = new FeedbackLoopEntry(
            UUID.randomUUID().toString(),
            FeedbackActionType.SCORE_RELEASE,
            "teacher01",
            "建议补充算法复杂度与真实应用限制。",
            sourceVersion.id(),
            sourceVersion.id(),
            Instant.now()
        );
        ResultReport report = new ResultReport(
            UUID.randomUUID().toString(),
            assignment.id(),
            assignment.title(),
            assignment.classId(),
            assignment.className(),
            student.id(),
            student.name(),
            sourceVersion.id(),
            sourceVersion.version(),
            dimensions.stream().mapToInt(DimensionScore::score).sum(),
            dimensions,
            List.of("概念准确，课程知识点覆盖较全", "案例和报告结构基本完整"),
            List.of("算法复杂度分析不足", "修改建议还可以更具体"),
            List.of("补充算法适用边界", "强化结论与证据的对应关系"),
            "teacher01",
            "整体完成度较高，建议围绕算法分析与证据支撑继续优化。",
            Instant.now(),
            List.of(feedback)
        );
        reports.put(report.id(), report);
    }

    private List<ResultReport> filterReports(String classId, String assignmentId, String studentId) {
        return listReports().stream()
            .filter(report -> classId == null || classId.isBlank() || classId.equals(report.classId()))
            .filter(report -> assignmentId == null || assignmentId.isBlank() || assignmentId.equals(report.assignmentId()))
            .filter(report -> studentId == null || studentId.isBlank() || studentId.equals(report.studentId()))
            .toList();
    }

    private List<ClassDimensionAverage> buildClassAverages(List<ResultReport> reportList) {
        return reportList.stream()
            .flatMap(report -> report.dimensions().stream().map(dimension -> Map.entry(report, dimension)))
            .collect(Collectors.groupingBy(entry -> entry.getKey().classId() + "|" + entry.getKey().className() + "|" + entry.getValue().name()))
            .entrySet().stream()
            .map(entry -> {
                String[] parts = entry.getKey().split("\\|", 3);
                DoubleSummaryStatistics stats = entry.getValue().stream().mapToDouble(value -> value.getValue().score()).summaryStatistics();
                return new ClassDimensionAverage(parts[0], parts[1], parts[2], stats.getAverage());
            })
            .toList();
    }

    private List<ComparisonRow> buildStudentHistory(List<ResultReport> reportList) {
        return reportList.stream()
            .sorted(Comparator.comparing(ResultReport::releasedAt))
            .map(report -> new ComparisonRow(report.assignmentTitle(), report.overallScore(), report.sourceVersionNumber(), report.className(), report.studentName()))
            .toList();
    }

    private List<ComparisonRow> buildClassComparison(List<ResultReport> reportList) {
        return reportList.stream()
            .sorted(Comparator.comparing(ResultReport::overallScore).reversed())
            .map(report -> new ComparisonRow(report.assignmentTitle(), report.overallScore(), report.sourceVersionNumber(), report.className(), report.studentName()))
            .toList();
    }

    private ResultReport withFeedback(ResultReport report, FeedbackLoopEntry entry) {
        List<FeedbackLoopEntry> feedbackTrail = new ArrayList<>(report.feedbackTrail());
        feedbackTrail.add(entry);
        return new ResultReport(
            report.id(),
            report.assignmentId(),
            report.assignmentTitle(),
            report.classId(),
            report.className(),
            report.studentId(),
            report.studentName(),
            report.sourceVersionId(),
            report.sourceVersionNumber(),
            report.overallScore(),
            report.dimensions(),
            report.strengths(),
            report.weaknesses(),
            report.suggestions(),
            report.evaluator(),
            report.teacherSummary(),
            report.releasedAt(),
            List.copyOf(feedbackTrail)
        );
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
            if (!assignment.versions().isEmpty()) {
                return assignment.versions().get(assignment.versions().size() - 1);
            }
            return new AssignmentVersion(
                UUID.randomUUID().toString(),
                assignment.id(),
                1,
                "unknown",
                "unknown",
                "virtual-initial",
                "application/octet-stream",
                0,
                "virtual://initial",
                "初始版本",
                com.example.eduevaluation.assignment.AssignmentStatus.SUBMITTED,
                Instant.now()
            );
        }
        return assignment.versions().stream()
            .filter(version -> version.id().equals(versionId))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "作业版本不存在"));
    }

    private ResultReport requireReport(String id) {
        ResultReport report = reports.get(id);
        if (report == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "评价报告不存在");
        }
        return report;
    }

    private List<DimensionScore> validateDimensions(List<DimensionScore> dimensions) {
        if (dimensions == null || dimensions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "评分维度不能为空");
        }
        return dimensions.stream()
            .map(dimension -> new DimensionScore(requireText(dimension.name(), "维度名称不能为空"), dimension.score(), dimension.maxScore() <= 0 ? 25 : dimension.maxScore(), trimToEmpty(dimension.comment())))
            .toList();
    }

    private List<String> normalizeTextList(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .toList();
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

