import axios from 'axios';

const baseUrl = '/api/video';

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
export type VideoTaskStatus =
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

export type VideoAnalysisOptions = {
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

export type VideoMetadata = {
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

export type VideoScene = {
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
  scenes?: VideoScene[];
  keywords?: string[];
};

export type TechnicalQuality = {
  videoQuality: string;
  audioQuality: string;
  stability: string;
  overallScore: number;
};

export type VideoAnalysisResult = {
  taskId: string;
  fileName: string;
  status: VideoTaskStatus;
  metadata?: VideoMetadata;
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

export type VideoAnalysisRequest = {
  taskId?: string;
  fileName: string;
  filePath: string;
  options?: VideoAnalysisOptions;
  videoType?: 'work' | 'defense';
  criteriaText?: string;
};

export type VideoUploadResult = {
  success: boolean;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  message?: string;
};

// API 函数
export async function uploadVideo(file: File): Promise<VideoUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post<VideoUploadResult>(`${baseUrl}/upload`, formData);
  return response.data;
}

export async function analyzeVideo(request: VideoAnalysisRequest): Promise<VideoAnalysisResult> {
  const response = await axios.post<VideoAnalysisResult>(`${baseUrl}/analyze`, request);
  return response.data;
}

export async function analyzeVideoAsync(request: VideoAnalysisRequest): Promise<{ taskId: string }> {
  const response = await axios.post<{ task_id: string; taskId?: string }>(`${baseUrl}/analyze/async`, request);
  // 兼容 snake_case 和 camelCase
  return { taskId: response.data.taskId ?? response.data.task_id };
}

export async function getVideoTaskStatus(taskId: string): Promise<VideoAnalysisResult> {
  const response = await axios.get<any>(`${baseUrl}/tasks/${taskId}`);
  const data = response.data;
  // 兼容 snake_case 和 camelCase
  return {
    taskId: data.taskId ?? data.task_id ?? taskId,
    fileName: data.fileName ?? data.file_name ?? '',
    status: data.status,
    metadata: data.metadata,
    keyframes: data.keyframes,
    audioAnalysis: data.audioAnalysis ?? data.audio_analysis,
    contentAnalysis: data.contentAnalysis ?? data.content_analysis,
    technicalQuality: data.technicalQuality ?? data.technical_quality,
    progress: data.progress ?? 0,
    startedAt: data.startedAt ?? data.started_at,
    completedAt: data.completedAt ?? data.completed_at,
    processingTimeMs: data.processingTimeMs ?? data.processing_time_ms,
    error: data.error,
    warnings: data.warnings,
  };
}

export async function getVideoTaskProgress(taskId: string): Promise<{
  taskId: string;
  status: VideoTaskStatus;
  progress: number;
  currentStage: string;
}> {
  const response = await axios.get(`${baseUrl}/tasks/${taskId}/progress`);
  return response.data;
}

export async function listVideoTasks(): Promise<{
  total: number;
  tasks: Array<{
    taskId: string;
    fileName: string;
    status: VideoTaskStatus;
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
      status: VideoTaskStatus;
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

export async function deleteVideoTask(taskId: string): Promise<void> {
  await axios.delete(`${baseUrl}/tasks/${taskId}`);
}

export async function getVideoCapabilities(): Promise<{
  supportedFormats: string[];
  maxDurationSeconds: number;
  maxFileSizeMb: number;
  features: Record<string, any>;
}> {
  const response = await axios.get(`${baseUrl}/capabilities`);
  return response.data;
}
