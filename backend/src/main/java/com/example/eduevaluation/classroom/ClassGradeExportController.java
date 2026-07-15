package com.example.eduevaluation.classroom;

import com.example.eduevaluation.work.WorkTaskEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/classes")
public class ClassGradeExportController {

    private final ClassService classService;
    private final ObjectMapper objectMapper;

    public ClassGradeExportController(ClassService classService, ObjectMapper objectMapper) {
        this.classService = classService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/{classId}/grades.csv")
    public ResponseEntity<byte[]> exportGrades(@PathVariable String classId) {
        ClassEntity courseClass = classService.getClass(classId);
        if (courseClass == null) {
            return ResponseEntity.notFound().build();
        }
        StringBuilder csv = new StringBuilder("\uFEFF学号,姓名,成绩,评语\r\n");
        for (GradeRow row : gradeRows(classId)) {
            csv.append(csv(row.studentNumber())).append(',')
                    .append(csv(row.studentName())).append(',')
                    .append(csv(row.score())).append(',')
                    .append(csv(row.comment())).append("\r\n");
        }
        return attachment(courseClass.getClassName() + "_成绩评语.csv", "text/csv;charset=UTF-8",
                csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/{classId}/grade-report.txt")
    public ResponseEntity<byte[]> exportReport(@PathVariable String classId) {
        ClassEntity courseClass = classService.getClass(classId);
        if (courseClass == null) {
            return ResponseEntity.notFound().build();
        }
        List<GradeRow> rows = gradeRows(classId);
        List<GradeRow> graded = rows.stream().filter(row -> row.score() != null).toList();
        String report = buildReport(courseClass.getClassName(), rows, graded);
        return attachment(courseClass.getClassName() + "_成绩分析报告.txt", "text/plain;charset=UTF-8",
                report.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/{classId}/grade-report.pdf")
    public ResponseEntity<byte[]> exportPdfReport(@PathVariable String classId) {
        ClassEntity courseClass = classService.getClass(classId);
        if (courseClass == null) {
            return ResponseEntity.notFound().build();
        }
        List<GradeRow> rows = gradeRows(classId);
        String report = buildReport(courseClass.getClassName(), rows,
                rows.stream().filter(row -> row.score() != null).toList());
        return attachment(courseClass.getClassName() + "_成绩分析报告.pdf", "application/pdf",
                renderPdf(report));
    }

    private byte[] renderPdf(String report) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (PdfDocument pdf = new PdfDocument(new PdfWriter(output));
                Document document = new Document(pdf, PageSize.A4)) {
            document.setFont(loadChineseFont()).setMargins(40, 44, 40, 44);
            for (String line : report.replace("\uFEFF", "").split("\\r?\\n", -1)) {
                if (line.isBlank()) {
                    document.add(new Paragraph("").setMarginBottom(4));
                } else if ("班级成绩分析报告".equals(line)) {
                    document.add(new Paragraph(line).setBold().setFontSize(20)
                            .setTextAlignment(com.itextpdf.layout.properties.TextAlignment.CENTER)
                            .setMarginBottom(18));
                } else if (line.matches("[一二三四五六七八]、.*")) {
                    document.add(new Paragraph(line).setBold().setFontSize(13)
                            .setMarginTop(10).setMarginBottom(5));
                } else {
                    document.add(new Paragraph(line).setFontSize(10.5f).setMarginTop(1).setMarginBottom(1));
                }
            }
        }
        return output.toByteArray();
    }

    private PdfFont loadChineseFont() {
        String[] fontPaths = {
                "C:/Windows/Fonts/simhei.ttf",
                "C:/Windows/Fonts/simsun.ttc",
                "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
                "/usr/share/fonts/wqy-microhei/wqy-microhei.ttc",
                "/System/Library/Fonts/PingFang.ttc"
        };
        for (String fontPath : fontPaths) {
            try {
                return PdfFontFactory.createFont(fontPath, "Identity-H");
            } catch (Exception ignored) {
                // Try the next platform font.
            }
        }
        try {
            return PdfFontFactory.createFont("STSong-Light", "UniGB-UCS2-H");
        } catch (Exception e) {
            throw new IllegalStateException("无法加载中文 PDF 字体", e);
        }
    }

    private String buildReport(String className, List<GradeRow> rows, List<GradeRow> graded) {
        DoubleSummary summary = summarize(graded);
        StringBuilder report = new StringBuilder("\uFEFF班级成绩分析报告\r\n\r\n");
        report.append("班级：").append(className).append("\r\n\r\n");
        report.append("一、完成情况\r\n")
                .append("学生人数：").append(rows.size()).append("\r\n")
                .append("已完成评分：").append(graded.size()).append("\r\n")
                .append("未完成评分：").append(rows.size() - graded.size()).append("\r\n")
                .append("评分完成率：").append(percent(graded.size(), rows.size())).append("\r\n\r\n");

        report.append("二、成绩概况\r\n")
                .append("平均分：").append(number(summary.average())).append("\r\n")
                .append("中位数：").append(number(summary.median())).append("\r\n")
                .append("最高分：").append(number(summary.maximum())).append("\r\n")
                .append("最低分：").append(number(summary.minimum())).append("\r\n")
                .append("标准差：").append(number(summary.standardDeviation())).append("\r\n")
                .append("优秀率（90分及以上）：").append(percent(countAtLeast(graded, 90), graded.size())).append("\r\n")
                .append("及格率（60分及以上）：").append(percent(countAtLeast(graded, 60), graded.size())).append("\r\n\r\n");

        report.append("三、成绩分布\r\n")
                .append("90-100分：").append(countRange(graded, 90, 101)).append(" 人\r\n")
                .append("80-89分：").append(countRange(graded, 80, 90)).append(" 人\r\n")
                .append("70-79分：").append(countRange(graded, 70, 80)).append(" 人\r\n")
                .append("60-69分：").append(countRange(graded, 60, 70)).append(" 人\r\n")
                .append("60分以下：").append(countRange(graded, 0, 60)).append(" 人\r\n\r\n");

        appendDimensions(report, graded);
        appendAttentionList(report, rows);
        appendFrequentItems(report, "六、班级共性优点", graded, GradeRow::strengths);
        appendFrequentItems(report, "七、班级共性问题", graded, GradeRow::weaknesses);
        appendFrequentItems(report, "八、教学改进建议", graded, GradeRow::suggestions);
        return report.toString();
    }

    private void appendDimensions(StringBuilder report, List<GradeRow> graded) {
        Map<String, DimensionTotal> totals = new LinkedHashMap<>();
        graded.stream().flatMap(row -> row.dimensions().stream()).forEach(score ->
                totals.computeIfAbsent(score.name(), ignored -> new DimensionTotal()).add(score));
        report.append("四、评分维度表现\r\n");
        if (totals.isEmpty()) {
            report.append("暂无可统计的评分维度数据。\r\n\r\n");
            return;
        }
        totals.entrySet().stream()
                .sorted(Comparator.comparingDouble(entry -> -entry.getValue().rate()))
                .forEach(entry -> report.append(entry.getKey()).append("：")
                        .append(number(entry.getValue().averageScore())).append("/")
                        .append(number(entry.getValue().averageMaximum())).append("，得分率 ")
                        .append(number(entry.getValue().rate())).append("%\r\n"));
        report.append("\r\n");
    }

    private void appendAttentionList(StringBuilder report, List<GradeRow> rows) {
        report.append("五、重点关注学生\r\n");
        List<String> attention = rows.stream()
                .filter(row -> row.score() == null || row.score() < 60)
                .map(row -> studentLabel(row) + (row.score() == null ? "（未完成评分）" : "（" + number(row.score()) + "分）"))
                .toList();
        if (attention.isEmpty()) {
            report.append("暂无未评分或不及格学生。\r\n\r\n");
            return;
        }
        attention.forEach(item -> report.append("- ").append(item).append("\r\n"));
        report.append("\r\n");
    }

    private void appendFrequentItems(StringBuilder report, String title, List<GradeRow> rows,
            java.util.function.Function<GradeRow, List<String>> extractor) {
        Map<String, Long> counts = new LinkedHashMap<>();
        rows.stream().flatMap(row -> extractor.apply(row).stream())
                .map(String::trim).filter(value -> !value.isEmpty())
                .forEach(value -> counts.merge(value, 1L, Long::sum));
        report.append(title).append("\r\n");
        List<Map.Entry<String, Long>> frequent = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5).toList();
        if (frequent.isEmpty()) {
            report.append("暂无可汇总数据。\r\n\r\n");
            return;
        }
        frequent.forEach(entry -> report.append("- ").append(entry.getKey())
                .append("（").append(entry.getValue()).append("人）\r\n"));
        report.append("\r\n");
    }

    private List<GradeRow> gradeRows(String classId) {
        List<GradeRow> rows = new ArrayList<>();
        for (StudentEntity student : classService.listStudentsWithWorks(classId)) {
            WorkTaskEntity task = student.getStudentWorks().stream()
                    .map(StudentWorkEntity::getWorkTask)
                    .filter(work -> work != null && "completed".equals(work.getStatus()))
                    .max(Comparator.comparing(WorkTaskEntity::getUpdatedAt))
                    .orElse(null);
            rows.add(toGradeRow(student, task));
        }
        return rows;
    }

    private GradeRow toGradeRow(StudentEntity student, WorkTaskEntity task) {
        GradeRow empty = new GradeRow(student.getStudentNumber(), student.getStudentName(), null, "",
                List.of(), List.of(), List.of(), List.of());
        if (task == null || task.getResultJson() == null) {
            return empty;
        }
        try {
            JsonNode root = objectMapper.readTree(task.getResultJson());
            JsonNode evaluation = root.path("content_analysis").path("evaluation");
            if (evaluation.isMissingNode()) {
                evaluation = root.path("contentAnalysis").path("evaluation");
            }
            Double score = doubleValue(evaluation, "total_score", "totalScore");
            String comment = contentOnlyComment(textValue(evaluation, "brief_comment", "briefComment"));
            return new GradeRow(student.getStudentNumber(), student.getStudentName(), score, comment,
                    dimensions(evaluation.path("scores")), texts(evaluation.path("strengths")),
                    texts(evaluation.path("weaknesses")), texts(evaluation.path("priority_suggestions")));
        } catch (Exception ignored) {
            return empty;
        }
    }

    private List<DimensionScore> dimensions(JsonNode scores) {
        List<DimensionScore> result = new ArrayList<>();
        if (!scores.isArray()) {
            return result;
        }
        for (JsonNode item : scores) {
            String name = textValue(item, "dimension", "dimensionName");
            Double score = doubleValue(item, "score", "score");
            Double maximum = doubleValue(item, "max_score", "maxScore");
            if (!name.isBlank() && score != null && maximum != null && maximum > 0) {
                result.add(new DimensionScore(name, score, maximum));
            }
        }
        return result;
    }

    private List<String> texts(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node.isArray()) {
            node.forEach(item -> {
                if (item.isTextual()) {
                    if (!isDurationFeedback(item.asText())) {
                        values.add(item.asText());
                    }
                } else if (item.has("suggestion")) {
                    String suggestion = item.path("suggestion").asText();
                    if (!isDurationFeedback(suggestion)) {
                        values.add(suggestion);
                    }
                }
            });
        }
        return values;
    }

    private String contentOnlyComment(String comment) {
        StringBuilder result = new StringBuilder();
        for (String sentence : comment.split("(?<=[。！？；])")) {
            if (!sentence.isBlank() && !isDurationFeedback(sentence)) {
                result.append(sentence);
            }
        }
        return result.toString().trim();
    }

    private boolean isDurationFeedback(String value) {
        return value.matches(".*(?:时长|片长|播放时间|过长|过短|\\d+(?:\\.\\d+)?\\s*(?:分钟|分|秒)).*");
    }

    private Double doubleValue(JsonNode node, String snakeCase, String camelCase) {
        JsonNode value = node.has(snakeCase) ? node.get(snakeCase) : node.get(camelCase);
        return value != null && value.isNumber() ? value.asDouble() : null;
    }

    private String textValue(JsonNode node, String snakeCase, String camelCase) {
        return node.path(snakeCase).asText(node.path(camelCase).asText(""));
    }

    private DoubleSummary summarize(List<GradeRow> rows) {
        List<Double> scores = rows.stream().map(GradeRow::score).sorted().toList();
        if (scores.isEmpty()) {
            return new DoubleSummary(0, 0, 0, 0, 0);
        }
        double average = scores.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double median = scores.size() % 2 == 1 ? scores.get(scores.size() / 2)
                : (scores.get(scores.size() / 2 - 1) + scores.get(scores.size() / 2)) / 2;
        double variance = scores.stream().mapToDouble(score -> Math.pow(score - average, 2)).average().orElse(0);
        return new DoubleSummary(average, median, scores.get(scores.size() - 1), scores.get(0), Math.sqrt(variance));
    }

    private long countAtLeast(List<GradeRow> rows, double minimum) {
        return rows.stream().filter(row -> row.score() >= minimum).count();
    }

    private long countRange(List<GradeRow> rows, double minimum, double maximumExclusive) {
        return rows.stream().filter(row -> row.score() >= minimum && row.score() < maximumExclusive).count();
    }

    private String percent(long numerator, long denominator) {
        return denominator == 0 ? "0.0%" : number(numerator * 100.0 / denominator) + "%";
    }

    private String number(double value) {
        return String.format(Locale.ROOT, "%.1f", value);
    }

    private String studentLabel(GradeRow row) {
        return (row.studentNumber() == null || row.studentNumber().isBlank() ? "无学号" : row.studentNumber())
                + "-" + row.studentName();
    }

    private ResponseEntity<byte[]> attachment(String filename, String contentType, byte[] body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + filename)
                .contentType(MediaType.parseMediaType(contentType))
                .body(body);
    }

    private String csv(Object value) {
        return "\"" + (value == null ? "" : value.toString().replace("\"", "\"\"")) + "\"";
    }

    private record GradeRow(String studentNumber, String studentName, Double score, String comment,
            List<DimensionScore> dimensions, List<String> strengths, List<String> weaknesses, List<String> suggestions) {
    }

    private record DimensionScore(String name, double score, double maximum) {
    }

    private record DoubleSummary(double average, double median, double maximum, double minimum,
            double standardDeviation) {
    }

    private static final class DimensionTotal {
        private double score;
        private double maximum;
        private int count;

        void add(DimensionScore item) {
            score += item.score();
            maximum += item.maximum();
            count++;
        }

        double averageScore() {
            return count == 0 ? 0 : score / count;
        }

        double averageMaximum() {
            return count == 0 ? 0 : maximum / count;
        }

        double rate() {
            return maximum == 0 ? 0 : score * 100 / maximum;
        }
    }
}
