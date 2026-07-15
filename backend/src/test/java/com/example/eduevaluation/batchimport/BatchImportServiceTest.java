package com.example.eduevaluation.batchimport;

import com.example.eduevaluation.assignment.AssignmentEntity;
import com.example.eduevaluation.assignment.AssignmentService;
import com.example.eduevaluation.classroom.ClassService;
import com.example.eduevaluation.classroom.StudentRepository;
import com.example.eduevaluation.common.AiWorkerClient;
import com.example.eduevaluation.work.WorkTaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayOutputStream;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BatchImportServiceTest {

    @TempDir
    Path tempDir;

    private StudentRepository studentRepository;
    private BatchImportService service;

    @BeforeEach
    void setUp() {
        studentRepository = mock(StudentRepository.class);
        AssignmentService assignmentService = mock(AssignmentService.class);
        AssignmentEntity assignment = new AssignmentEntity("assignment-1", "作业", "");
        assignment.setClassId("class-1");
        when(assignmentService.getAssignment("assignment-1")).thenReturn(assignment);

        service = new BatchImportService(
                studentRepository,
                mock(ClassService.class),
                assignmentService,
                mock(AiWorkerClient.class),
                mock(WorkTaskService.class));
        ReflectionTestUtils.setField(service, "uploadDir", tempDir.toString());
    }

    @Test
    void previewsValidStudentArchiveAsNewStudent() throws Exception {
        when(studentRepository.findByClassIdAndStudentNumber("class-1", "20260001"))
                .thenReturn(List.of());
        byte[] inner = zip(Map.of(
                "作品.mp4", new byte[]{1, 2, 3},
                "作品介绍.docx", new byte[]{4, 5, 6}));
        byte[] outer = zip(Map.of("20260001-张三.zip", inner));

        Map<String, Object> result = service.preview(
                "class-1",
                "assignment-1",
                new MockMultipartFile("archive", "班级作品.zip", "application/zip", outer));

        List<?> entries = (List<?>) result.get("entries");
        Map<?, ?> entry = (Map<?, ?>) entries.get(0);
        assertThat(entry.get("status")).isEqualTo("ready");
        assertThat(entry.get("studentNumber")).isEqualTo("20260001");
        assertThat(entry.get("studentName")).isEqualTo("张三");
        assertThat(entry.get("willCreateStudent")).isEqualTo(true);
    }

    @Test
    void rejectsUnsupportedIntroductionWithoutBlockingPreview() throws Exception {
        byte[] inner = zip(Map.of(
                "作品.mp4", new byte[]{1},
                "作品介绍.txt", new byte[]{2}));
        byte[] outer = zip(Map.of("20260002-李四.zip", inner));

        Map<String, Object> result = service.preview(
                "class-1",
                "assignment-1",
                new MockMultipartFile("archive", "班级作品.zip", "application/zip", outer));

        List<?> entries = (List<?>) result.get("entries");
        Map<?, ?> entry = (Map<?, ?>) entries.get(0);
        assertThat(entry.get("status")).isEqualTo("invalid");
        assertThat(entry.get("reason")).asString().contains("Word 或 PDF");
    }

    private byte[] zip(Map<String, byte[]> files) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (Map.Entry<String, byte[]> file : files.entrySet()) {
                zip.putNextEntry(new ZipEntry(file.getKey()));
                zip.write(file.getValue());
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }
}
