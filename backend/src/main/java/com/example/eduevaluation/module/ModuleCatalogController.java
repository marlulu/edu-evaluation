package com.example.eduevaluation.module;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/modules")
public class ModuleCatalogController {

    private static final List<ModuleDescriptor> MODULES = List.of(
        new ModuleDescriptor(
            "assignment-management",
            "作业管理模块",
            "frontend/src/features/assignment-management/",
            "com.example.eduevaluation.assignment",
            "N/A",
            "作业发布、提交任务、文件元数据和教师处理入口。"
        ),
        new ModuleDescriptor(
            "content-parsing",
            "多模态内容解析模块",
            "frontend/src/features/content-parsing/",
            "com.example.eduevaluation.content",
            "ai-worker/app/modules/content_parsing/",
            "文档解析、OCR、ASR、视频帧抽取和证据片段标准化。"
        ),
        new ModuleDescriptor(
            "intelligent-evaluation",
            "智能评价模块",
            "frontend/src/features/intelligent-evaluation/",
            "com.example.eduevaluation.evaluation",
            "ai-worker/app/modules/intelligent_evaluation/",
            "Rubric 评分、模型调用、证据关联、问题识别和改进建议。"
        ),
        new ModuleDescriptor(
            "result-feedback",
            "结果展示与反馈模块",
            "frontend/src/features/result-feedback/",
            "com.example.eduevaluation.result",
            "N/A",
            "评价报告、教师复核、分数调整、反馈交付和结果状态。"
        ),
        new ModuleDescriptor(
            "system-admin",
            "系统管理与配置模块",
            "frontend/src/features/system-admin/",
            "com.example.eduevaluation.system",
            "ai-worker/app/modules/system_config/",
            "评分规则、模型配置、文件策略和运行配置管理。"
        )
    );

    @GetMapping
    public List<ModuleDescriptor> modules() {
        return MODULES;
    }
}

