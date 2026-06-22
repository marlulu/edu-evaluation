package com.example.eduevaluation.result;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class SimplePdfExporter {

    private SimplePdfExporter() {
    }

    static byte[] export(ResultReport report) {
        List<String> lines = new ArrayList<>();
        lines.add("Evaluation Report");
        lines.add("Assignment: " + ascii(report.assignmentTitle()));
        lines.add("Student: " + ascii(report.studentName()));
        lines.add("Class: " + ascii(report.className()));
        lines.add("Version: " + report.sourceVersionNumber());
        lines.add("Overall Score: " + report.overallScore());
        lines.add("Evaluator: " + ascii(report.evaluator()));
        lines.add("Summary: " + ascii(report.teacherSummary()));
        report.dimensions().forEach(dimension -> lines.add(ascii(dimension.name()) + ": " + dimension.score() + "/" + dimension.maxScore()));
        report.suggestions().forEach(suggestion -> lines.add("Suggestion: " + ascii(suggestion)));
        return minimalPdf(lines);
    }

    private static byte[] minimalPdf(List<String> lines) {
        StringBuilder content = new StringBuilder("BT /F1 12 Tf 50 780 Td 14 TL ");
        for (int index = 0; index < lines.size(); index++) {
            if (index > 0) {
                content.append("T* ");
            }
            content.append("(").append(escape(lines.get(index))).append(") Tj ");
        }
        content.append("ET");

        String stream = content.toString();
        String obj1 = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n";
        String obj2 = "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n";
        String obj3 = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n";
        String obj4 = "4 0 obj << /Length " + stream.length() + " >> stream\n" + stream + "\nendstream endobj\n";
        String obj5 = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n";

        StringBuilder pdf = new StringBuilder("%PDF-1.4\n");
        List<Integer> offsets = new ArrayList<>();
        offsets.add(0);
        offsets.add(pdf.length());
        pdf.append(obj1);
        offsets.add(pdf.length());
        pdf.append(obj2);
        offsets.add(pdf.length());
        pdf.append(obj3);
        offsets.add(pdf.length());
        pdf.append(obj4);
        offsets.add(pdf.length());
        pdf.append(obj5);
        int xrefOffset = pdf.length();
        pdf.append("xref\n0 6\n");
        pdf.append("0000000000 65535 f \n");
        for (int index = 1; index <= 5; index++) {
            pdf.append(String.format("%010d 00000 n \n", offsets.get(index)));
        }
        pdf.append("trailer << /Size 6 /Root 1 0 R >>\nstartxref\n");
        pdf.append(xrefOffset).append("\n%%EOF");
        return pdf.toString().getBytes(StandardCharsets.ISO_8859_1);
    }

    private static String ascii(String value) {
        if (value == null) {
            return "";
        }
        return value.chars()
            .mapToObj(ch -> ch >= 32 && ch <= 126 ? String.valueOf((char) ch) : "?")
            .reduce("", String::concat);
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }
}

