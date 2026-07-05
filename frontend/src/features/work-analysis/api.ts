import axios from 'axios';

const baseUrl = '/api/work';

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? error.response?.data?.error ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// 类型定义
export type WorkTaskStatus =
  | 'pending'
  | 'preprocessing'
  | 'extracting_metadata'
  | 'extracting_keyframes'
  | 'extracting_audio'
  | 'transcribing'
  | 'analyzing_content'
  | 'completed'
  | 'failed';

export type KeyframeMethod = 'interval' | 'scene_change' | 'hybrid';

export type WorkAnalysisOptions = {
  extractKeyframes?: boolean;
  keyframeMethod?: KeyframeMethod;
  maxKeyframes?: number;
  sceneThreshold?: number;
  minIntervalSeconds?: number;
  transcribeAudio?: boolean;
  whisperLanguage?: string | null;
  analyzeContent?: boolean;
  ocrEnabled?: boolean;
};

export type WorkMetadata = {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  fileSize: number;
  formatName: string;
  hasAudio: boolean;
  audioCodec?: string;
  audioSampleRate?: number;
};

export type KeyframeInfo = {
  frameId: string;
  timestampSeconds: number;
  frameIndex: number;
  sceneChangeScore?: number;
  imagePath?: string;
  imageBase64?: string;
};

export type AudioSegment = {
  startTime: number;
  endTime: number;
  text: string;
  confidence?: number;
  speakerId?: string;
};

export type AudioAnalysis = {
  transcription: AudioSegment[];
  totalSpeechDuration: number;
  averageSpeechRate: number;
  detectedLanguage: string;
  clarityScore?: number;
};

export type WorkScene = {
  startTime: number;
  endTime: number;
  description: string;
  keyframeIds?: string[];
  sceneType?: string;
};

export type ContentAnalysis = {
  overallTopic: string;
  summary: string;
  keyPoints: string[];
  scenes?: WorkScene[];
  keywords?: string[];
  evaluation?: EvaluationResult;
};

export type ScoreItem = {
  dimension: string;
  maxScore: number;
  score: number;
  evidence: string;
  suggestion: string;
};

export type EvaluationResult = {
  totalScore: number;
  grade: string;
  scores: ScoreItem[];
  strengths: string[];
  weaknesses: string[];
  prioritySuggestions: string[];
  criteriaText?: string;
  rawText?: string;
};

export type TechnicalQuality = {
  videoQuality: string;
  audioQuality: string;
  stability: string;
  overallScore: number;
};

export type WorkAnalysisResult = {
  taskId: string;
  fileName: string;
  status: WorkTaskStatus;
  metadata?: WorkMetadata;
  keyframes?: KeyframeInfo[];
  audioAnalysis?: AudioAnalysis;
  contentAnalysis?: ContentAnalysis;
  technicalQuality?: TechnicalQuality;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  processingTimeMs?: number;
  error?: string;
  warnings?: string[];
};

export type WorkAnalysisRequest = {
  taskId?: string;
  fileName: string;
  filePath: string;
  options?: WorkAnalysisOptions;
  criteriaText?: string;
};

export type WorkUploadResult = {
  success: boolean;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  message?: string;
};

// API 函数
export async function uploadWork(file: File): Promise<WorkUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post<WorkUploadResult>(`${baseUrl}/upload`, formData);
  return response.data;
}

export async function uploadCriteria(file: File): Promise<WorkUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post<WorkUploadResult>(`${baseUrl}/upload-criteria`, formData);
  return response.data;
}

export async function parseCriteriaFile(filePath: string): Promise<{ success: boolean; text: string }> {
  const response = await axios.post<{ success: boolean; text: string }>(`${baseUrl}/parse-criteria`, { filePath });
  return response.data;
}

export async function analyzeWork(request: WorkAnalysisRequest): Promise<WorkAnalysisResult> {
  const response = await axios.post<WorkAnalysisResult>(`${baseUrl}/analyze`, request);
  return response.data;
}

export async function analyzeWorkAsync(request: WorkAnalysisRequest): Promise<{ taskId: string }> {
  const response = await axios.post<{ task_id: string; taskId?: string }>(`${baseUrl}/analyze/async`, request);
  // 兼容 snake_case 和 camelCase
  return { taskId: response.data.taskId ?? response.data.task_id };
}

export async function getWorkTaskStatus(taskId: string): Promise<WorkAnalysisResult> {
  const response = await axios.get<any>(`${baseUrl}/tasks/${taskId}`);
  const data = response.data;
  // 兼容 snake_case 和 camelCase
  const contentAnalysis = data.contentAnalysis ?? data.content_analysis;
  // 转换 evaluation 内部字段
  if (contentAnalysis?.evaluation) {
    const ev = contentAnalysis.evaluation;
    contentAnalysis.evaluation = {
      totalScore: ev.totalScore ?? ev.total_score ?? 0,
      grade: ev.grade ?? '',
      scores: (ev.scores ?? []).map((s: any) => ({
        dimension: s.dimension ?? '',
        maxScore: s.maxScore ?? s.max_score ?? 0,
        score: s.score ?? 0,
        evidence: s.evidence ?? '',
        suggestion: s.suggestion ?? '',
      })),
      strengths: ev.strengths ?? [],
      weaknesses: ev.weaknesses ?? [],
      prioritySuggestions: ev.prioritySuggestions ?? ev.priority_suggestions ?? [],
      criteriaText: ev.criteriaText ?? ev.criteria_text ?? '',
      rawText: ev.rawText ?? ev.raw_text,
    };
  }
  return {
    taskId: data.taskId ?? data.task_id ?? taskId,
    fileName: data.fileName ?? data.file_name ?? '',
    status: data.status,
    metadata: data.metadata,
    keyframes: data.keyframes,
    audioAnalysis: data.audioAnalysis ?? data.audio_analysis,
    contentAnalysis,
    technicalQuality: data.technicalQuality ?? data.technical_quality,
    progress: data.progress ?? 0,
    startedAt: data.startedAt ?? data.started_at,
    completedAt: data.completedAt ?? data.completed_at,
    processingTimeMs: data.processingTimeMs ?? data.processing_time_ms,
    error: data.error,
    warnings: data.warnings,
  };
}

export async function getWorkTaskProgress(taskId: string): Promise<{
  taskId: string;
  status: WorkTaskStatus;
  progress: number;
  currentStage: string;
}> {
  const response = await axios.get(`${baseUrl}/tasks/${taskId}/progress`);
  return response.data;
}

export async function listWorkTasks(): Promise<{
  total: number;
  tasks: Array<{
    taskId: string;
    fileName: string;
    status: WorkTaskStatus;
    progress: number;
  }>;
}> {
  const response = await axios.get<{
    total: number;
    tasks: Array<{
      task_id?: string;
      taskId?: string;
      file_name?: string;
      fileName?: string;
      status: WorkTaskStatus;
      progress: number;
    }>;
  }>(`${baseUrl}/tasks`);
  // 兼容 snake_case 和 camelCase
  return {
    total: response.data.total,
    tasks: response.data.tasks.map((t) => ({
      taskId: t.taskId ?? t.task_id ?? '',
      fileName: t.fileName ?? t.file_name ?? '',
      status: t.status,
      progress: t.progress,
    })),
  };
}

export async function deleteWorkTask(taskId: string): Promise<void> {
  await axios.delete(`${baseUrl}/tasks/${taskId}`);
}

export async function getWorkCapabilities(): Promise<{
  supportedFormats: string[];
  maxDurationSeconds: number;
  maxFileSizeMb: number;
  features: Record<string, any>;
}> {
  const response = await axios.get(`${baseUrl}/capabilities`);
  return response.data;
}
