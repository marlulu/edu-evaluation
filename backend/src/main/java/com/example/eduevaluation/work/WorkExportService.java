package com.example.eduevaluation.work;

import com.example.eduevaluation.classroom.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.*;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class WorkExportService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final WorkTaskRepository repository;
    private final StudentRepository studentRepository;
    private final ClassRepository classRepository;

    // 颜色定义
    private static final DeviceRgb PRIMARY_COLOR = new DeviceRgb(24, 144, 255);
    private static final DeviceRgb SUCCESS_COLOR = new DeviceRgb(82, 196, 26);
    private static final DeviceRgb WARNING_COLOR = new DeviceRgb(250, 173, 20);
    private static final DeviceRgb ERROR_COLOR = new DeviceRgb(255, 77, 79);
    private static final DeviceRgb GRAY_COLOR = new DeviceRgb(102, 102, 102);
    private static final DeviceRgb LIGHT_BG = new DeviceRgb(250, 250, 250);

    public WorkExportService(WorkTaskRepository repository,
                             StudentRepository studentRepository,
                             ClassRepository classRepository) {
        this.repository = repository;
        this.studentRepository = studentRepository;
        this.classRepository = classRepository;
    }

    public byte[] exportToPdf(List<String> taskIds) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf, PageSize.A4);
        document.setMargins(36, 36, 36, 36);

        // 加载中文字体
        PdfFont chineseFont = loadChineseFont();
        document.setFont(chineseFont);

        // 标题
        Paragraph title = new Paragraph("作品分析报告")
                .setFontSize(24)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(8);
        document.add(title);

        Paragraph subtitle = new Paragraph("AI 教育评估系统")
                .setFontSize(12)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(24);
        document.add(subtitle);

        // 分隔线
        document.add(new LineSeparator(new SolidBorder(PRIMARY_COLOR, 1)));

        // 导出每个任务
        for (int i = 0; i < taskIds.size(); i++) {
            String taskId = taskIds.get(i);
            WorkTaskEntity task = repository.findById(taskId).orElse(null);
            if (task == null) continue;

            if (i > 0) {
                document.add(new AreaBreak());
            }

            exportTask(document, task, i + 1);
        }

        // 页脚
        document.add(new Paragraph("\n"));
        document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));
        Paragraph footer = new Paragraph("导出时间: " + java.time.LocalDateTime.now().toString().replace("T", " "))
                .setFontSize(9)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.RIGHT);
        document.add(footer);

        document.close();
        return baos.toByteArray();
    }

    /**
     * 按班级导出所有学生作品
     */
    public byte[] exportByClass(String classId) throws IOException {
        ClassEntity classEntity = classRepository.findById(classId).orElse(null);
        if (classEntity == null) {
            throw new IllegalArgumentException("班级不存在: " + classId);
        }

        List<StudentEntity> students = studentRepository.findByClassIdWithWorksOrderByCreatedAtDesc(classId);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf, PageSize.A4);
        document.setMargins(36, 36, 36, 36);

        PdfFont chineseFont = loadChineseFont();
        document.setFont(chineseFont);

        // 报告标题
        Paragraph title = new Paragraph("班级作品分析报告")
                .setFontSize(24)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(8);
        document.add(title);

        // 班级信息
        Paragraph subtitle = new Paragraph(classEntity.getClassName())
                .setFontSize(16)
                .setFontColor(PRIMARY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(4);
        document.add(subtitle);

        Paragraph info = new Paragraph("共 " + students.size() + " 名学生")
                .setFontSize(12)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(24);
        document.add(info);

        document.add(new LineSeparator(new SolidBorder(PRIMARY_COLOR, 1)));

        // 按学生分组导出
        boolean firstStudent = true;
        for (StudentEntity student : students) {
            List<WorkTaskEntity> tasks = student.getStudentWorks().stream()
                    .map(StudentWorkEntity::getWorkTask)
                    .filter(t -> t != null)
                    .collect(Collectors.toList());

            if (tasks.isEmpty()) continue;

            if (!firstStudent) {
                document.add(new AreaBreak());
            }
            firstStudent = false;

            // 学生信息头
            String studentLabel = student.getStudentName();
            if (student.getStudentNumber() != null && !student.getStudentNumber().isEmpty()) {
                studentLabel += " (" + student.getStudentNumber() + ")";
            }
            studentLabel += " - 共 " + tasks.size() + " 件作品";

            Paragraph studentTitle = new Paragraph(studentLabel)
                    .setFontSize(16)
                    .setBold()
                    .setMarginTop(8)
                    .setMarginBottom(12);
            document.add(studentTitle);

            document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));

            // 导出该学生的每个作品
            for (int i = 0; i < tasks.size(); i++) {
                if (i > 0) {
                    document.add(new AreaBreak());
                }
                exportTask(document, tasks.get(i), i + 1);
            }
        }

        // 页脚
        document.add(new Paragraph("\n"));
        document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));
        Paragraph footer = new Paragraph("导出时间: " + java.time.LocalDateTime.now().toString().replace("T", " "))
                .setFontSize(9)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.RIGHT);
        document.add(footer);

        document.close();
        return baos.toByteArray();
    }

    /**
     * 按多个班级导出所有学生作品
     */
    public byte[] exportByClasses(List<String> classIds) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf, PageSize.A4);
        document.setMargins(36, 36, 36, 36);

        PdfFont chineseFont = loadChineseFont();
        document.setFont(chineseFont);

        // 报告标题
        Paragraph title = new Paragraph("班级作品分析报告")
                .setFontSize(24)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(8);
        document.add(title);

        Paragraph info = new Paragraph("共 " + classIds.size() + " 个班级")
                .setFontSize(12)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(24);
        document.add(info);

        document.add(new LineSeparator(new SolidBorder(PRIMARY_COLOR, 1)));

        boolean firstClass = true;
        for (String classId : classIds) {
            ClassEntity classEntity = classRepository.findById(classId).orElse(null);
            if (classEntity == null) continue;

            List<StudentEntity> students = studentRepository.findByClassIdWithWorksOrderByCreatedAtDesc(classId);

            if (!firstClass) {
                document.add(new AreaBreak());
            }
            firstClass = false;

            // 班级标题
            Paragraph classTitle = new Paragraph("班级: " + classEntity.getClassName())
                    .setFontSize(18)
                    .setBold()
                    .setFontColor(PRIMARY_COLOR)
                    .setMarginTop(8)
                    .setMarginBottom(12);
            document.add(classTitle);

            document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));

            // 按学生分组导出
            boolean firstStudent = true;
            for (StudentEntity student : students) {
                List<WorkTaskEntity> tasks = student.getStudentWorks().stream()
                        .map(StudentWorkEntity::getWorkTask)
                        .filter(t -> t != null)
                        .collect(Collectors.toList());

                if (tasks.isEmpty()) continue;

                if (!firstStudent) {
                    document.add(new AreaBreak());
                }
                firstStudent = false;

                // 学生信息头
                String studentLabel = student.getStudentName();
                if (student.getStudentNumber() != null && !student.getStudentNumber().isEmpty()) {
                    studentLabel += " (" + student.getStudentNumber() + ")";
                }
                studentLabel += " - 共 " + tasks.size() + " 件作品";

                Paragraph studentTitle = new Paragraph(studentLabel)
                        .setFontSize(14)
                        .setBold()
                        .setMarginTop(8)
                        .setMarginBottom(8);
                document.add(studentTitle);

                // 导出该学生的每个作品
                for (int i = 0; i < tasks.size(); i++) {
                    if (i > 0) {
                        document.add(new AreaBreak());
                    }
                    exportTask(document, tasks.get(i), i + 1);
                }
            }
        }

        // 页脚
        document.add(new Paragraph("\n"));
        document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));
        Paragraph footer = new Paragraph("导出时间: " + java.time.LocalDateTime.now().toString().replace("T", " "))
                .setFontSize(9)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.RIGHT);
        document.add(footer);

        document.close();
        return baos.toByteArray();
    }

    /**
     * 按多个学生导出所有作品
     */
    public byte[] exportByStudents(List<String> studentIds) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf, PageSize.A4);
        document.setMargins(36, 36, 36, 36);

        PdfFont chineseFont = loadChineseFont();
        document.setFont(chineseFont);

        // 报告标题
        Paragraph title = new Paragraph("学生作品分析报告")
                .setFontSize(24)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(8);
        document.add(title);

        Paragraph info = new Paragraph("共 " + studentIds.size() + " 名学生")
                .setFontSize(12)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(24);
        document.add(info);

        document.add(new LineSeparator(new SolidBorder(PRIMARY_COLOR, 1)));

        boolean firstStudent = true;
        for (String studentId : studentIds) {
            StudentEntity student = studentRepository.findByIdWithWorks(studentId);
            if (student == null) continue;

            List<WorkTaskEntity> tasks = student.getStudentWorks().stream()
                    .map(StudentWorkEntity::getWorkTask)
                    .filter(t -> t != null)
                    .collect(Collectors.toList());

            if (tasks.isEmpty()) continue;

            if (!firstStudent) {
                document.add(new AreaBreak());
            }
            firstStudent = false;

            // 获取班级名称
            String className = "";
            ClassEntity classEntity = classRepository.findById(student.getClassId()).orElse(null);
            if (classEntity != null) {
                className = classEntity.getClassName();
            }

            // 学生信息头
            String studentLabel = student.getStudentName();
            if (student.getStudentNumber() != null && !student.getStudentNumber().isEmpty()) {
                studentLabel += " (" + student.getStudentNumber() + ")";
            }
            if (!className.isEmpty()) {
                studentLabel += " - " + className;
            }
            studentLabel += " - 共 " + tasks.size() + " 件作品";

            Paragraph studentTitle = new Paragraph(studentLabel)
                    .setFontSize(16)
                    .setBold()
                    .setMarginTop(8)
                    .setMarginBottom(12);
            document.add(studentTitle);

            document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));

            // 导出该学生的每个作品
            for (int i = 0; i < tasks.size(); i++) {
                if (i > 0) {
                    document.add(new AreaBreak());
                }
                exportTask(document, tasks.get(i), i + 1);
            }
        }

        // 页脚
        document.add(new Paragraph("\n"));
        document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));
        Paragraph footer = new Paragraph("导出时间: " + java.time.LocalDateTime.now().toString().replace("T", " "))
                .setFontSize(9)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.RIGHT);
        document.add(footer);

        document.close();
        return baos.toByteArray();
    }

    /**
     * 按学生导出所有作品
     */
    public byte[] exportByStudent(String studentId) throws IOException {
        StudentEntity student = studentRepository.findByIdWithWorks(studentId);
        if (student == null) {
            throw new IllegalArgumentException("学生不存在: " + studentId);
        }

        List<WorkTaskEntity> tasks = student.getStudentWorks().stream()
                .map(StudentWorkEntity::getWorkTask)
                .filter(t -> t != null)
                .collect(Collectors.toList());

        // 获取班级名称
        String className = "";
        ClassEntity classEntity = classRepository.findById(student.getClassId()).orElse(null);
        if (classEntity != null) {
            className = classEntity.getClassName();
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf, PageSize.A4);
        document.setMargins(36, 36, 36, 36);

        PdfFont chineseFont = loadChineseFont();
        document.setFont(chineseFont);

        // 报告标题
        Paragraph title = new Paragraph("学生作品分析报告")
                .setFontSize(24)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(8);
        document.add(title);

        // 学生信息
        String studentLabel = student.getStudentName();
        if (student.getStudentNumber() != null && !student.getStudentNumber().isEmpty()) {
            studentLabel += " (" + student.getStudentNumber() + ")";
        }
        Paragraph subtitle = new Paragraph(studentLabel)
                .setFontSize(16)
                .setFontColor(PRIMARY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(4);
        document.add(subtitle);

        if (!className.isEmpty()) {
            Paragraph classInfo = new Paragraph(className)
                    .setFontSize(12)
                    .setFontColor(GRAY_COLOR)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(4);
            document.add(classInfo);
        }

        Paragraph countInfo = new Paragraph("共 " + tasks.size() + " 件作品")
                .setFontSize(12)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(24);
        document.add(countInfo);

        document.add(new LineSeparator(new SolidBorder(PRIMARY_COLOR, 1)));

        // 导出每个作品
        for (int i = 0; i < tasks.size(); i++) {
            if (i > 0) {
                document.add(new AreaBreak());
            }
            exportTask(document, tasks.get(i), i + 1);
        }

        // 页脚
        document.add(new Paragraph("\n"));
        document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));
        Paragraph footer = new Paragraph("导出时间: " + java.time.LocalDateTime.now().toString().replace("T", " "))
                .setFontSize(9)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.RIGHT);
        document.add(footer);

        document.close();
        return baos.toByteArray();
    }

    /**
     * 按学生导出指定作品
     */
    public byte[] exportStudentSelectedWorks(String studentId, List<String> taskIds) throws IOException {
        StudentEntity student = studentRepository.findByIdWithWorks(studentId);
        if (student == null) {
            throw new IllegalArgumentException("学生不存在: " + studentId);
        }

        // 只保留指定的作品
        List<WorkTaskEntity> tasks = taskIds.stream()
                .map(id -> repository.findById(id).orElse(null))
                .filter(t -> t != null)
                .collect(Collectors.toList());

        // 获取班级名称
        String className = "";
        ClassEntity classEntity = classRepository.findById(student.getClassId()).orElse(null);
        if (classEntity != null) {
            className = classEntity.getClassName();
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf, PageSize.A4);
        document.setMargins(36, 36, 36, 36);

        PdfFont chineseFont = loadChineseFont();
        document.setFont(chineseFont);

        // 报告标题
        Paragraph title = new Paragraph("学生作品分析报告")
                .setFontSize(24)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(8);
        document.add(title);

        // 学生信息
        String studentLabel = student.getStudentName();
        if (student.getStudentNumber() != null && !student.getStudentNumber().isEmpty()) {
            studentLabel += " (" + student.getStudentNumber() + ")";
        }
        Paragraph subtitle = new Paragraph(studentLabel)
                .setFontSize(16)
                .setFontColor(PRIMARY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(4);
        document.add(subtitle);

        if (!className.isEmpty()) {
            Paragraph classInfo = new Paragraph(className)
                    .setFontSize(12)
                    .setFontColor(GRAY_COLOR)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(4);
            document.add(classInfo);
        }

        Paragraph countInfo = new Paragraph("共 " + tasks.size() + " 件作品（已选）")
                .setFontSize(12)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(24);
        document.add(countInfo);

        document.add(new LineSeparator(new SolidBorder(PRIMARY_COLOR, 1)));

        // 导出每个作品
        for (int i = 0; i < tasks.size(); i++) {
            if (i > 0) {
                document.add(new AreaBreak());
            }
            exportTask(document, tasks.get(i), i + 1);
        }

        // 页脚
        document.add(new Paragraph("\n"));
        document.add(new LineSeparator(new SolidBorder(GRAY_COLOR, 0.5f)));
        Paragraph footer = new Paragraph("导出时间: " + java.time.LocalDateTime.now().toString().replace("T", " "))
                .setFontSize(9)
                .setFontColor(GRAY_COLOR)
                .setTextAlignment(TextAlignment.RIGHT);
        document.add(footer);

        document.close();
        return baos.toByteArray();
    }

    private void exportTask(Document document, WorkTaskEntity task, int index) throws IOException {
        JsonNode result = null;
        try {
            String resultJson = task.getResultJson();
            if (resultJson != null && !resultJson.isEmpty()) {
                result = objectMapper.readTree(resultJson);
            }
        } catch (Exception e) {
            // 解析失败，继续处理
        }

        JsonNode metadata = result != null ? result.get("metadata") : null;
        JsonNode contentAnalysis = result != null ? result.get("content_analysis") : null;
        JsonNode audioAnalysis = result != null ? result.get("audio_analysis") : null;
        JsonNode technicalQuality = result != null ? result.get("technical_quality") : null;

        // 任务标题
        String fileName = task.getFileName() != null ? task.getFileName() : "未知文件";
        Paragraph taskTitle = new Paragraph(String.format("%d. %s", index, fileName))
                .setFontSize(18)
                .setBold()
                .setMarginTop(16)
                .setMarginBottom(12);
        document.add(taskTitle);

        // 基本信息表格
        Table infoTable = new Table(UnitValue.createPercentArray(new float[]{30, 70}))
                .useAllAvailableWidth()
                .setMarginBottom(16);

        addInfoRow(infoTable, "文件名", fileName);
        addInfoRow(infoTable, "状态", task.getStatus());
        addInfoRow(infoTable, "提交时间", task.getCreatedAt() != null ? task.getCreatedAt().toString().replace("T", " ") : "-");
        addInfoRow(infoTable, "更新时间", task.getUpdatedAt() != null ? task.getUpdatedAt().toString().replace("T", " ") : "-");

        if (metadata != null) {
            addInfoRow(infoTable, "时长", formatDuration(metadata.path("duration_seconds").asDouble(0)));
            addInfoRow(infoTable, "分辨率", metadata.path("width").asInt(0) + " × " + metadata.path("height").asInt(0));
            addInfoRow(infoTable, "文件大小", formatFileSize(metadata.path("file_size").asLong(0)));
        }
        document.add(infoTable);

        // 技术质量
        if (technicalQuality != null) {
            Paragraph qualityTitle = new Paragraph("技术质量评估")
                    .setFontSize(14)
                    .setBold()
                    .setMarginTop(12)
                    .setMarginBottom(8);
            document.add(qualityTitle);

            Table qualityTable = new Table(UnitValue.createPercentArray(new float[]{30, 70}))
                    .useAllAvailableWidth()
                    .setMarginBottom(12);

            addInfoRow(qualityTable, "视频质量", technicalQuality.path("video_quality").asText("-"));
            addInfoRow(qualityTable, "音频质量", technicalQuality.path("audio_quality").asText("-"));
            addInfoRow(qualityTable, "稳定性", technicalQuality.path("stability").asText("-"));
            addInfoRow(qualityTable, "综合评分", technicalQuality.path("overall_score").asInt(0) + " 分");
            document.add(qualityTable);
        }

        // 语音转录
        if (audioAnalysis != null && audioAnalysis.has("transcription")) {
            JsonNode transcription = audioAnalysis.get("transcription");
            if (transcription.isArray() && transcription.size() > 0) {
                Paragraph transcriptionTitle = new Paragraph("语音转录")
                        .setFontSize(14)
                        .setBold()
                        .setMarginTop(12)
                        .setMarginBottom(8);
                document.add(transcriptionTitle);

                Table transcriptionTable = new Table(UnitValue.createPercentArray(new float[]{20, 60, 20}))
                        .useAllAvailableWidth()
                        .setMarginBottom(12);

                // 表头
                addTableHeader(transcriptionTable, "时间");
                addTableHeader(transcriptionTable, "内容");
                addTableHeader(transcriptionTable, "置信度");

                for (JsonNode segment : transcription) {
                    String startTime = formatDuration(segment.path("start_time").asDouble(0));
                    String endTime = formatDuration(segment.path("end_time").asDouble(0));
                    String text = segment.path("text").asText("");
                    double confidence = segment.path("confidence").asDouble(0);

                    addTableCell(transcriptionTable, startTime + " - " + endTime);
                    addTableCell(transcriptionTable, text);
                    addTableCell(transcriptionTable, String.format("%.0f%%", confidence * 100));
                }
                document.add(transcriptionTable);
            }
        }

        // 内容分析
        if (contentAnalysis != null) {
            Paragraph contentTitle = new Paragraph("内容分析")
                    .setFontSize(14)
                    .setBold()
                    .setMarginTop(12)
                    .setMarginBottom(8);
            document.add(contentTitle);

            // 主题
            String topic = contentAnalysis.path("overall_topic").asText("未知");
            addKeyValueParagraph(document, "视频主题", topic);

            // 摘要
            String summary = contentAnalysis.path("summary").asText("");
            if (!summary.isEmpty()) {
                addKeyValueParagraph(document, "内容摘要", summary);
            }

            // 关键点
            JsonNode keyPoints = contentAnalysis.path("key_points");
            if (keyPoints.isArray() && keyPoints.size() > 0) {
                Paragraph keyPointsTitle = new Paragraph("关键要点:")
                        .setFontSize(11)
                        .setBold()
                        .setMarginTop(8);
                document.add(keyPointsTitle);

                for (int i = 0; i < keyPoints.size(); i++) {
                    document.add(new Paragraph((i + 1) + ". " + keyPoints.get(i).asText())
                            .setFontSize(10)
                            .setMarginLeft(20));
                }
            }

            // 关键词
            JsonNode keywords = contentAnalysis.path("keywords");
            if (keywords.isArray() && keywords.size() > 0) {
                Paragraph keywordsTitle = new Paragraph("关键词: ")
                        .setFontSize(11)
                        .setBold()
                        .setMarginTop(8);

                StringBuilder keywordsStr = new StringBuilder();
                for (JsonNode keyword : keywords) {
                    if (keywordsStr.length() > 0) keywordsStr.append(", ");
                    keywordsStr.append(keyword.asText());
                }
                keywordsTitle.add(keywordsStr.toString());
                document.add(keywordsTitle);
            }

            // 评分结果
            JsonNode evaluation = contentAnalysis.path("evaluation");
            if (evaluation != null && !evaluation.isMissingNode()) {
                exportEvaluation(document, evaluation);
            }
        }

        // 错误信息
        if ("failed".equals(task.getStatus()) && result != null) {
            String error = result.has("error") ? result.get("error").asText() : null;
            if (error != null && !error.isEmpty()) {
                Paragraph errorTitle = new Paragraph("错误信息")
                        .setFontSize(14)
                        .setBold()
                        .setFontColor(ERROR_COLOR)
                        .setMarginTop(12)
                        .setMarginBottom(8);
                document.add(errorTitle);

                document.add(new Paragraph(error)
                        .setFontSize(10)
                        .setFontColor(ERROR_COLOR));
            }
        }
    }

    private void exportEvaluation(Document document, JsonNode evaluation) throws IOException {
        Paragraph evalTitle = new Paragraph("评分结果")
                .setFontSize(14)
                .setBold()
                .setMarginTop(16)
                .setMarginBottom(8);
        document.add(evalTitle);

        // 总分
        double totalScore = evaluation.path("total_score").asDouble(0);
        String grade = evaluation.path("grade").asText("");

        // 使用 Text 对象代替 Span
        com.itextpdf.layout.element.Text scoreText = new com.itextpdf.layout.element.Text(String.format("%.1f", totalScore))
                .setFontSize(36)
                .setBold()
                .setFontColor(getGradeColor(grade));

        com.itextpdf.layout.element.Text slashText = new com.itextpdf.layout.element.Text(" / 100")
                .setFontSize(14)
                .setFontColor(GRAY_COLOR);

        Paragraph scoreParagraph = new Paragraph()
                .setMarginBottom(12);
        scoreParagraph.add(scoreText);
        scoreParagraph.add(slashText);

        if (!grade.isEmpty()) {
            com.itextpdf.layout.element.Text gradeText = new com.itextpdf.layout.element.Text("  " + grade)
                    .setFontSize(14)
                    .setBold()
                    .setFontColor(getGradeColor(grade));
            scoreParagraph.add(gradeText);
        }

        document.add(scoreParagraph);

        // 各维度得分
        JsonNode scores = evaluation.path("scores");
        if (scores.isArray() && scores.size() > 0) {
            Paragraph dimTitle = new Paragraph("各维度得分:")
                    .setFontSize(11)
                    .setBold()
                    .setMarginTop(8);
            document.add(dimTitle);

            Table scoreTable = new Table(UnitValue.createPercentArray(new float[]{30, 15, 55}))
                    .useAllAvailableWidth()
                    .setMarginBottom(12);

            addTableHeader(scoreTable, "维度");
            addTableHeader(scoreTable, "得分");
            addTableHeader(scoreTable, "评价");

            for (JsonNode scoreItem : scores) {
                String dimension = scoreItem.path("dimension").asText("");
                double score = scoreItem.path("score").asDouble(0);
                double maxScore = scoreItem.path("max_score").asDouble(100);
                String evidence = scoreItem.path("evidence").asText("");

                addTableCell(scoreTable, dimension);
                addTableCell(scoreTable, String.format("%.0f / %.0f", score, maxScore));
                addTableCell(scoreTable, evidence);
            }
            document.add(scoreTable);
        }

        // 优点
        JsonNode strengths = evaluation.path("strengths");
        if (strengths.isArray() && strengths.size() > 0) {
            Paragraph strengthsTitle = new Paragraph("✓ 优点:")
                    .setFontSize(11)
                    .setBold()
                    .setFontColor(SUCCESS_COLOR)
                    .setMarginTop(8);
            document.add(strengthsTitle);

            for (JsonNode strength : strengths) {
                document.add(new Paragraph("• " + strength.asText())
                        .setFontSize(10)
                        .setMarginLeft(20));
            }
        }

        // 不足
        JsonNode weaknesses = evaluation.path("weaknesses");
        if (weaknesses.isArray() && weaknesses.size() > 0) {
            Paragraph weaknessesTitle = new Paragraph("⚠ 不足:")
                    .setFontSize(11)
                    .setBold()
                    .setFontColor(WARNING_COLOR)
                    .setMarginTop(8);
            document.add(weaknessesTitle);

            for (JsonNode weakness : weaknesses) {
                document.add(new Paragraph("• " + weakness.asText())
                        .setFontSize(10)
                        .setMarginLeft(20));
            }
        }

        // 改进建议
        JsonNode suggestions = evaluation.path("priority_suggestions");
        if (suggestions.isArray() && suggestions.size() > 0) {
            Paragraph suggestionsTitle = new Paragraph("🎯 优先改进建议:")
                    .setFontSize(11)
                    .setBold()
                    .setMarginTop(8);
            document.add(suggestionsTitle);

            for (int i = 0; i < suggestions.size(); i++) {
                String priority = i == 0 ? "最紧迫" : i == 1 ? "次重要" : "锦上添花";
                document.add(new Paragraph(String.format("%d. [%s] %s", i + 1, priority, suggestions.get(i).asText()))
                        .setFontSize(10)
                        .setMarginLeft(20));
            }
        }
    }

    private PdfFont loadChineseFont() {
        try {
            // 尝试使用系统中文字体
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
                }
            }

            // 如果没有找到系统字体，使用内置亚洲字体
            return PdfFontFactory.createFont("STSong-Light", "UniGB-UCS2-H");
        } catch (Exception e) {
            try {
                return PdfFontFactory.createFont("Helvetica", "WinAnsiEncoding");
            } catch (Exception ex) {
                throw new RuntimeException("无法加载字体", ex);
            }
        }
    }

    private void addInfoRow(Table table, String label, String value) {
        table.addCell(new Cell().add(new Paragraph(label).setBold().setFontSize(10))
                .setBorder(Border.NO_BORDER)
                .setPaddingRight(10));
        table.addCell(new Cell().add(new Paragraph(value).setFontSize(10))
                .setBorder(Border.NO_BORDER));
    }

    private void addTableHeader(Table table, String text) {
        table.addHeaderCell(new Cell().add(new Paragraph(text).setBold().setFontSize(10))
                .setBackgroundColor(LIGHT_BG)
                .setPadding(8));
    }

    private void addTableCell(Table table, String text) {
        table.addCell(new Cell().add(new Paragraph(text).setFontSize(10))
                .setPadding(6));
    }

    private void addKeyValueParagraph(Document document, String key, String value) {
        Paragraph p = new Paragraph()
                .setFontSize(10)
                .setMarginBottom(4);
        p.add(new com.itextpdf.layout.element.Text(key + ": ").setBold());
        p.add(value);
        document.add(p);
    }

    private String formatDuration(double seconds) {
        int mins = (int) (seconds / 60);
        int secs = (int) (seconds % 60);
        return String.format("%d:%02d", mins, secs);
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024));
    }

    private DeviceRgb getGradeColor(String grade) {
        if (grade.contains("优秀")) return SUCCESS_COLOR;
        if (grade.contains("良好")) return PRIMARY_COLOR;
        if (grade.contains("合格") || grade.contains("中等") || grade.contains("及格")) return WARNING_COLOR;
        return ERROR_COLOR;
    }

    private static class LineSeparator extends Div {
        public LineSeparator(com.itextpdf.layout.borders.Border border) {
            setBorderBottom(border);
            setMarginTop(10);
            setMarginBottom(10);
        }
    }
}
