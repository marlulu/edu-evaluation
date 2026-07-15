"""音乐作品分析模块

注意：此模块需要可选依赖 librosa 和 soundfile。
如需使用音乐分析功能，请安装：
    pip install librosa soundfile
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# 延迟导入 numpy，避免在未安装时阻止模块加载
try:
    import numpy as np
except ImportError:
    np = None  # type: ignore


@dataclass
class MusicFeatures:
    """音乐特征"""
    # 基础信息
    duration: float = 0.0
    sample_rate: int = 0

    # 节奏特征
    bpm: float = 0.0
    beat_count: int = 0
    tempo_stability: float = 0.0

    # 调性特征
    key: str = ""  # 主调 (C, D, E, F, G, A, B)
    mode: str = ""  # 调式 (major, minor)
    key_confidence: float = 0.0

    # 频谱特征
    spectral_centroid_mean: float = 0.0
    spectral_bandwidth_mean: float = 0.0
    spectral_rolloff_mean: float = 0.0
    zero_crossing_rate_mean: float = 0.0

    # 能量特征
    rms_mean: float = 0.0
    rms_std: float = 0.0
    dynamic_range: float = 0.0

    # MFCC 特征（音色）
    mfcc_means: list[float] = field(default_factory=list)
    mfcc_stds: list[float] = field(default_factory=list)

    # 情绪特征
    energy_level: str = ""  # low, medium, high
    valence: float = 0.0  # 情绪效价 (0-1, 悲伤-快乐)
    arousal: float = 0.0  # 情绪唤醒度 (0-1, 平静-激动)

    # 结构特征
    segments: list[dict] = field(default_factory=list)
    onset_strength_mean: float = 0.0


@dataclass
class MusicSegment:
    """音乐段落"""
    start: float
    end: float
    label: str  # intro, verse, chorus, bridge, outro, instrumental
    energy: float = 0.0
    spectral_centroid: float = 0.0


def analyze_music(audio_path: str) -> MusicFeatures:
    """分析音乐作品特征"""
    if np is None:
        raise ImportError("numpy is required for music analysis. Install with: pip install numpy")

    try:
        import librosa

        logger.info("Loading audio file: %s", audio_path)
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        features = MusicFeatures(
            duration=duration,
            sample_rate=sr,
        )

        # 1. 节奏分析
        logger.info("Analyzing rhythm...")
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        features.bpm = float(tempo) if np.isscalar(tempo) else float(tempo[0])
        features.beat_count = len(beat_frames)

        # 计算节拍稳定性
        if len(beat_frames) > 1:
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            beat_intervals = np.diff(beat_times)
            features.tempo_stability = 1.0 - (np.std(beat_intervals) / np.mean(beat_intervals))
            features.tempo_stability = max(0.0, min(1.0, features.tempo_stability))

        # 2. 调性分析
        logger.info("Analyzing key...")
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)

        # 调性检测（简化版）
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

        # 计算与大调/小调的相关性
        major_corr = np.corrcoef(chroma_mean, major_profile)[0, 1]
        minor_corr = np.corrcoef(chroma_mean, minor_profile)[0, 1]

        key_index = np.argmax(chroma_mean)
        features.key = key_names[key_index]

        if major_corr > minor_corr:
            features.mode = "major"
            features.key_confidence = float(major_corr)
        else:
            features.mode = "minor"
            features.key_confidence = float(minor_corr)

        # 3. 频谱特征
        logger.info("Analyzing spectral features...")
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        zcr = librosa.feature.zero_crossing_rate(y)[0]

        features.spectral_centroid_mean = float(np.mean(spectral_centroids))
        features.spectral_bandwidth_mean = float(np.mean(spectral_bandwidth))
        features.spectral_rolloff_mean = float(np.mean(spectral_rolloff))
        features.zero_crossing_rate_mean = float(np.mean(zcr))

        # 4. 能量特征
        logger.info("Analyzing energy...")
        rms = librosa.feature.rms(y=y)[0]
        features.rms_mean = float(np.mean(rms))
        features.rms_std = float(np.std(rms))
        features.dynamic_range = float(np.max(rms) - np.min(rms)) if len(rms) > 0 else 0.0

        # 5. MFCC 特征（音色描述）
        logger.info("Analyzing MFCC...")
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        features.mfcc_means = [float(np.mean(mfcc[i])) for i in range(13)]
        features.mfcc_stds = [float(np.std(mfcc[i])) for i in range(13)]

        # 6. 情绪特征估算
        logger.info("Estimating mood...")
        features.energy_level = _estimate_energy_level(features.rms_mean, features.dynamic_range)
        features.valence = _estimate_valence(features.key, features.mode, features.bpm)
        features.arousal = _estimate_arousal(features.bpm, features.rms_mean)

        # 7. 结构分析
        logger.info("Analyzing structure...")
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        features.onset_strength_mean = float(np.mean(onset_env))

        # 使用频谱聚类进行段落分割
        features.segments = _detect_segments(y, sr, features.duration)

        logger.info("Music analysis completed: BPM=%.1f, Key=%s %s, Energy=%s",
                     features.bpm, features.key, features.mode, features.energy_level)

        return features

    except ImportError:
        logger.error("librosa not installed. Please install with: pip install librosa")
        raise
    except Exception as e:
        logger.error("Music analysis failed: %s", e)
        raise


def _estimate_energy_level(rms_mean: float, dynamic_range: float) -> str:
    """估算能量等级"""
    if rms_mean > 0.1 and dynamic_range > 0.05:
        return "high"
    elif rms_mean > 0.03:
        return "medium"
    else:
        return "low"


def _estimate_valence(key: str, mode: str, bpm: float) -> float:
    """估算情绪效价（快乐-悲伤）"""
    # 大调通常更快乐
    base_valence = 0.7 if mode == "major" else 0.3

    # 快节奏通常更快乐
    if bpm > 120:
        base_valence += 0.1
    elif bpm < 80:
        base_valence -= 0.1

    # 某些调性被认为更快乐
    happy_keys = ['C', 'G', 'D', 'A']
    sad_keys = ['F#', 'C#', 'G#', 'D#']

    if key in happy_keys:
        base_valence += 0.05
    elif key in sad_keys:
        base_valence -= 0.05

    return max(0.0, min(1.0, base_valence))


def _estimate_arousal(bpm: float, rms_mean: float) -> float:
    """估算情绪唤醒度（平静-激动）"""
    # BPM 贡献
    if bpm > 140:
        bpm_score = 0.9
    elif bpm > 120:
        bpm_score = 0.7
    elif bpm > 100:
        bpm_score = 0.5
    elif bpm > 80:
        bpm_score = 0.3
    else:
        bpm_score = 0.1

    # 能量贡献
    energy_score = min(1.0, rms_mean * 5)

    return (bpm_score * 0.6 + energy_score * 0.4)


def _detect_segments(y, sr: int, duration: float) -> list[dict]:
    """检测音乐段落"""
    import librosa

    segments = []

    try:
        # 使用频谱特征进行段落分割
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        # 使用 librosa 的段落检测
        bound_frames = librosa.segment.agglomerative(mfcc, k=6)
        bound_times = librosa.frames_to_time(bound_frames, sr=sr)

        # 计算每个段落的能量
        rms = librosa.feature.rms(y=y)[0]

        for i in range(len(bound_times) - 1):
            start = float(bound_times[i])
            end = float(bound_times[i + 1])

            # 获取段落对应的帧范围
            start_frame = bound_frames[i]
            end_frame = bound_frames[i + 1] if i + 1 < len(bound_frames) else len(rms)

            # 计算段落能量
            segment_rms = rms[start_frame:end_frame]
            energy = float(np.mean(segment_rms)) if len(segment_rms) > 0 else 0.0

            # 根据能量和位置判断段落类型
            label = _classify_segment(start, end, duration, energy, np.mean(rms))

            segments.append({
                "start": round(start, 2),
                "end": round(end, 2),
                "label": label,
                "energy": round(energy, 4),
            })

    except Exception as e:
        logger.warning("Segment detection failed: %s", e)
        # 回退：简单分为开头、中间、结尾
        segments = [
            {"start": 0.0, "end": round(duration * 0.15, 2), "label": "intro", "energy": 0.0},
            {"start": round(duration * 0.15, 2), "end": round(duration * 0.85, 2), "label": "main", "energy": 0.0},
            {"start": round(duration * 0.85, 2), "end": round(duration, 2), "label": "outro", "energy": 0.0},
        ]

    return segments


def _classify_segment(start: float, end: float, duration: float, energy: float, mean_energy: float) -> str:
    """根据位置和能量分类段落"""
    relative_start = start / duration if duration > 0 else 0
    relative_end = end / duration if duration > 0 else 0

    # 开头部分
    if relative_start < 0.1:
        return "intro"

    # 结尾部分
    if relative_end > 0.9:
        return "outro"

    # 高能量可能是副歌
    if energy > mean_energy * 1.2:
        return "chorus"

    # 低能量可能是间奏或桥段
    if energy < mean_energy * 0.6:
        return "bridge"

    # 默认为主歌
    return "verse"


def build_music_analysis_prompt(features: MusicFeatures, metadata: dict, lyrics: str = "") -> str:
    """构建音乐分析提示词（含歌词）"""
    # 调式描述
    mode_cn = "大调" if features.mode == "major" else "小调"

    # 能量描述
    energy_desc = {
        "low": "低能量，较为平静",
        "medium": "中等能量，适中",
        "high": "高能量，充满活力"
    }.get(features.energy_level, "未知")

    # 情绪描述
    if features.valence > 0.6:
        mood_desc = "积极向上"
    elif features.valence > 0.4:
        mood_desc = "中性平衡"
    else:
        mood_desc = "略带忧郁"

    # BPM 描述
    if features.bpm > 140:
        tempo_desc = "非常快"
    elif features.bpm > 120:
        tempo_desc = "快速"
    elif features.bpm > 100:
        tempo_desc = "中速"
    elif features.bpm > 80:
        tempo_desc = "慢速"
    else:
        tempo_desc = "非常慢"

    # 段落信息
    segments_text = "\n".join([
        f"  - {s['start']:.1f}s - {s['end']:.1f}s: {s['label']}"
        for s in features.segments[:6]  # 最多显示6个段落
    ])

    # 歌词部分
    lyrics_section = ""
    if lyrics:
        lyrics_section = f"""

歌词内容：
{lyrics}
"""
    else:
        lyrics_section = """

歌词内容：
（未能提取到歌词，可能是纯音乐或乐器演奏）
"""

    prompt = f"""请分析以下音乐作品，结合旋律特征和歌词内容进行综合评价：

音乐基础信息：
- 时长：{features.duration:.1f} 秒
- 采样率：{features.sample_rate} Hz
- 文件格式：{metadata.get('format_name', '未知')}

节奏特征：
- BPM（每分钟节拍数）：{features.bpm:.1f}
- 节拍数量：{features.beat_count}
- 节奏稳定性：{features.tempo_stability:.1%}
- 速度描述：{tempo_desc}

调性特征：
- 主调：{features.key}
- 调式：{mode_cn}
- 调性置信度：{features.key_confidence:.1%}

频谱特征：
- 频谱质心：{features.spectral_centroid_mean:.1f} Hz（音色明暗度）
- 频谱带宽：{features.spectral_bandwidth_mean:.1f} Hz（音色丰富度）
- 过零率：{features.zero_crossing_rate_mean:.4f}（噪声程度）

能量特征：
- 平均能量：{features.rms_mean:.4f}
- 动态范围：{features.dynamic_range:.4f}
- 能量等级：{energy_desc}

情绪特征：
- 情绪效价：{features.valence:.1%}（{mood_desc}）
- 唤醒度：{features.arousal:.1%}

音乐结构：
{segments_text}
{lyrics_section}
请提供以下分析：
1. 音乐风格和流派判断
2. 旋律与歌词的配合分析（如果有歌词）
3. 歌词内容解读（如果有歌词）
4. 情绪和氛围描述
5. 适合的使用场景
6. 编曲和制作质量评估
7. 整体评价和特点总结
"""
    return prompt


def build_music_evaluation_prompt(analysis_text: str, criteria_text: str) -> str:
    """构建音乐评判标准评分提示词"""
    return f"""请根据以下评判标准对音乐作品进行评分：

{criteria_text}

音乐作品分析：
{analysis_text}

请严格按照评判标准进行评分，返回 JSON 格式：
{{
    "total_score": 总分(0-100),
    "grade": "等级(优秀/良好/合格/不合格)",
    "scores": [
        {{
            "dimension": "评分维度",
            "max_score": 该维度满分,
            "score": 得分,
            "evidence": "评分依据",
            "suggestion": "改进建议"
        }}
    ],
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1", "不足2"],
    "priority_suggestions": ["建议1", "建议2", "建议3"]
}}
"""
