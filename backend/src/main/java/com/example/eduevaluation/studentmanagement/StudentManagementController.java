package com.example.eduevaluation.studentmanagement;

import com.example.eduevaluation.auth.AppPrincipal;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import java.io.ByteArrayOutputStream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

@RestController
@RequestMapping("/api/students")
public class StudentManagementController {
    private final StudentManagementService service;
    private final StudentImportService imports;

    public StudentManagementController(StudentManagementService service, StudentImportService imports) {
        this.service = service;
        this.imports = imports;
    }

    @GetMapping
    public List<StudentManagementService.StudentResponse> list(@AuthenticationPrincipal AppPrincipal principal) {
        return service.listStudents(principal);
    }

    @PostMapping
    public ResponseEntity<StudentManagementService.StudentResponse> create(
            @Valid @RequestBody StudentManagementService.StudentRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        StudentManagementService.StudentResponse result = service.createStudent(request, principal);
        return ResponseEntity.created(URI.create("/api/students/" + result.id())).body(result);
    }

    @PutMapping("/{studentId}")
    public StudentManagementService.StudentResponse update(
            @PathVariable String studentId,
            @Valid @RequestBody StudentManagementService.StudentRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return service.updateStudent(studentId, request, principal);
    }

    @DeleteMapping("/{studentId}")
    public ResponseEntity<Void> delete(@PathVariable String studentId, @AuthenticationPrincipal AppPrincipal principal) {
        service.deleteStudent(studentId, principal);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/groups")
    public List<StudentManagementService.GroupResponse> groups(@AuthenticationPrincipal AppPrincipal principal) {
        return service.listGroups(principal);
    }

    @PostMapping("/groups")
    public ResponseEntity<StudentManagementService.GroupResponse> createGroup(
            @Valid @RequestBody StudentManagementService.GroupRequest request,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        StudentManagementService.GroupResponse result = service.createGroup(request, principal);
        return ResponseEntity.created(URI.create("/api/students/groups/" + result.id())).body(result);
    }

    @PutMapping("/groups/{groupId}")
    public StudentManagementService.GroupResponse updateGroup(@PathVariable String groupId,
            @Valid @RequestBody StudentManagementService.GroupRequest request,
            @AuthenticationPrincipal AppPrincipal principal) {
        return service.updateGroup(groupId, request, principal);
    }

    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable String groupId, @AuthenticationPrincipal AppPrincipal principal) {
        service.deleteGroup(groupId, principal);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import/preview")
    public StudentImportService.ImportPreview previewImport(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) List<String> groupIds,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return imports.preview(file, groupIds, principal);
    }

    @PostMapping("/import/{draftId}/confirm")
    public StudentImportService.ImportResult confirmImport(
            @PathVariable String draftId,
            @AuthenticationPrincipal AppPrincipal principal
    ) {
        return imports.confirm(draftId, principal);
    }

    @GetMapping(value = "/import/template", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> importTemplate(@AuthenticationPrincipal AppPrincipal principal) {
        service.listStudents(principal);
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("学生导入");
            var header = sheet.createRow(0);
            header.createCell(0).setCellValue("学号");
            header.createCell(1).setCellValue("姓名");
            header.createCell(2).setCellValue("邮箱");
            var example = sheet.createRow(1);
            example.createCell(0).setCellValue("20240001");
            example.createCell(1).setCellValue("张三");
            example.createCell(2).setCellValue("zhangsan@example.edu");
            sheet.autoSizeColumn(0); sheet.autoSizeColumn(1); sheet.autoSizeColumn(2);
            workbook.write(output);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=student-import-template.xlsx")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(output.toByteArray());
        } catch (java.io.IOException exception) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "模板生成失败", exception);
        }
    }
}
