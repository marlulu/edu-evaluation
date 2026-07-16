package com.example.eduevaluation.studentmanagement;

import com.example.eduevaluation.auth.AppPrincipal;
import com.example.eduevaluation.auth.ModuleAction;
import com.example.eduevaluation.auth.ModulePermissionService;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StudentImportService {
    private final SharedStudentRepository students;
    private final StudentGroupRepository groups;
    private final GroupMembershipRepository memberships;
    private final ModulePermissionService permissions;
    private final Map<String, ImportDraft> drafts = new ConcurrentHashMap<>();

    public StudentImportService(
            SharedStudentRepository students,
            StudentGroupRepository groups,
            GroupMembershipRepository memberships,
            ModulePermissionService permissions
    ) {
        this.students = students;
        this.groups = groups;
        this.memberships = memberships;
        this.permissions = permissions;
    }

    public ImportPreview preview(MultipartFile file, List<String> groupIds, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.CREATE);
        validateGroups(groupIds);
        List<ImportRow> rows = parse(file);
        String draftId = UUID.randomUUID().toString();
        drafts.put(draftId, new ImportDraft(principal.userId(), groupIds == null ? List.of() : List.copyOf(groupIds), rows));
        int valid = (int) rows.stream().filter(ImportRow::valid).count();
        return new ImportPreview(draftId, rows, valid, rows.size() - valid);
    }

    @Transactional
    public ImportResult confirm(String draftId, AppPrincipal principal) {
        permissions.require(principal, ModulePermissionService.STUDENT, ModuleAction.CREATE);
        ImportDraft draft = drafts.remove(draftId);
        if (draft == null || !draft.ownerId().equals(principal.userId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "导入预览已失效");
        }
        List<Credential> credentials = new ArrayList<>();
        for (ImportRow row : draft.rows()) {
            if (!row.valid() || students.findByStudentNumber(row.studentNumber()).isPresent()) {
                continue;
            }
            String password = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            SharedStudentEntity student = students.save(new SharedStudentEntity(
                    UUID.randomUUID().toString(), row.studentNumber(), row.studentName(), row.email(), password));
            draft.groupIds().forEach(groupId -> memberships.save(new GroupMembership(student.getId(), groupId)));
            credentials.add(new Credential(row.studentNumber(), row.studentName(), password));
        }
        return new ImportResult(credentials.size(), draft.rows().size() - credentials.size(), credentials);
    }

    private List<ImportRow> parse(MultipartFile file) {
        try (InputStream input = file.getInputStream(); Workbook workbook = WorkbookFactory.create(input)) {
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            List<ImportRow> rows = new ArrayList<>();
            for (int index = 1; index <= sheet.getLastRowNum(); index++) {
                Row row = sheet.getRow(index);
                if (row == null) continue;
                String number = value(formatter, row, 0);
                String name = value(formatter, row, 1);
                String email = value(formatter, row, 2);
                if (number.isBlank() && name.isBlank() && email.isBlank()) continue;
                String issue = number.isBlank() ? "学号不能为空"
                        : name.isBlank() ? "姓名不能为空"
                        : students.findByStudentNumber(number).isPresent() ? "学号已存在" : null;
                rows.add(new ImportRow(index + 1, number, name, email.isBlank() ? null : email, issue == null, issue));
            }
            return rows;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无法读取导入文件", exception);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请使用规定的 Excel 模板", exception);
        }
    }

    private String value(DataFormatter formatter, Row row, int column) {
        return row.getCell(column) == null ? "" : formatter.formatCellValue(row.getCell(column)).trim();
    }

    private void validateGroups(List<String> groupIds) {
        List<String> selected = groupIds == null ? List.of() : groupIds.stream().distinct().toList();
        if (groups.findAllById(selected).size() != selected.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "包含不存在的学生组别");
        }
    }

    private record ImportDraft(String ownerId, List<String> groupIds, List<ImportRow> rows) {}
    public record ImportRow(int rowNumber, String studentNumber, String studentName, String email, boolean valid, String issue) {}
    public record ImportPreview(String draftId, List<ImportRow> rows, int validCount, int invalidCount) {}
    public record Credential(String studentNumber, String studentName, String initialPassword) {}
    public record ImportResult(int importedCount, int skippedCount, List<Credential> credentials) {}
}
