import {
  AppstoreAddOutlined,
  ControlOutlined,
  FileSearchOutlined,
  FormOutlined,
  RobotOutlined
} from '@ant-design/icons';
import type { ReactNode } from 'react';

export type SystemModule = {
  id: string;
  name: string;
  frontendPath: string;
  backendPackage: string;
  aiWorkerPath: string;
  responsibility: string;
  icon: ReactNode;
};

export const systemModules: SystemModule[] = [
  {
    id: 'assignment-management',
    name: '作业管理模块',
    frontendPath: 'frontend/src/features/assignment-management/',
    backendPackage: 'com.example.eduevaluation.assignment',
    aiWorkerPath: 'N/A',
    responsibility: '作业发布、提交任务、文件元数据和教师处理入口。',
    icon: <FormOutlined />
  },
  {
    id: 'content-parsing',
    name: '多模态内容解析模块',
    frontendPath: 'frontend/src/features/content-parsing/',
    backendPackage: 'com.example.eduevaluation.content',
    aiWorkerPath: 'ai-worker/app/modules/content_parsing/',
    responsibility: '图片/视频/音频/文本/压缩包解析，OCR/ASR、质量分析、结构化特征提取和多模态关联。',
    icon: <FileSearchOutlined />
  },
  {
    id: 'intelligent-evaluation',
    name: '智能评价模块',
    frontendPath: 'frontend/src/features/intelligent-evaluation/',
    backendPackage: 'com.example.eduevaluation.evaluation',
    aiWorkerPath: 'ai-worker/app/modules/intelligent_evaluation/',
    responsibility: 'Rubric 评分、模型调用、证据关联、问题识别和改进建议。',
    icon: <RobotOutlined />
  },
  {
    id: 'result-feedback',
    name: '结果展示与反馈模块',
    frontendPath: 'frontend/src/features/result-feedback/',
    backendPackage: 'com.example.eduevaluation.result',
    aiWorkerPath: 'N/A',
    responsibility: '评价报告、教师复核、分数调整、反馈交付和结果状态。',
    icon: <AppstoreAddOutlined />
  },
  {
    id: 'system-admin',
    name: '系统管理与配置模块',
    frontendPath: 'frontend/src/features/system-admin/',
    backendPackage: 'com.example.eduevaluation.system',
    aiWorkerPath: 'ai-worker/app/modules/system_config/',
    responsibility: '评分规则、模型配置、文件策略和运行配置管理。',
    icon: <ControlOutlined />
  }
];
