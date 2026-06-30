"""AI 分析：画面描述、综合分析、评判标准评分"""

import os
import re
import time

from openai import OpenAI

from .utils import encode_image_base64


def _call_ai(client: OpenAI, model: str, prompt: str, max_retries: int = 3) -> str:
    """通用 AI 调用（带重试）"""
    for attempt in range(max_retries):
        try:
            resp = client.responses.create(
                model=model,
                input=[{"role": "user", "content": prompt}],
                store=False,
            )
            return resp.output_text
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 5
                print(f"      [RETRY] API error, waiting {wait}s... ({e})")
                time.sleep(wait)
            else:
                return f"[AI 调用失败] {e}"


def _call_ai_multimodal(client: OpenAI, model: str, content: list, max_retries: int = 3) -> str:
    """多模态 AI 调用（带重试）"""
    for attempt in range(max_retries):
        try:
            resp = client.responses.create(
                model=model,
                input=[{"role": "user", "content": content}],
                store=False,
            )
            return resp.output_text.strip()
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 5
                print(f"      [RETRY] {e}, waiting {wait}s...")
                time.sleep(wait)
            else:
                return f"(画面分析失败: {e})"


# ==================== 画面描述 ====================

def describe_all_frames_with_ai(client: OpenAI, model: str, keyframes: list[dict], max_retries: int = 3) -> str:
    """一次调用分析所有关键帧，返回综合场景描述"""
    frame_labels = []
    for i, kf in enumerate(keyframes):
        if os.path.exists(kf["path"]):
            frame_labels.append(f"图{i+1} ({kf['timestamp']}s)")

    if not frame_labels:
        return "(无可分析的关键帧)"

    content = [
        {
            "type": "input_text",
            "text": f"""以下是视频的 {len(frame_labels)} 张关键帧截图，按时间顺序排列：{', '.join(frame_labels)}。

请用中文分析：
1. 每张图的画面内容（角色、场景、动作），用 "图N: ..." 格式，每图1-2句
2. 整体视频主题推测
3. 内容变化趋势（画面如何推进）"""
        }
    ]

    for kf in keyframes:
        if os.path.exists(kf["path"]):
            content.append({
                "type": "input_image",
                "image_url": f"data:image/jpeg;base64,{encode_image_base64(kf['path'])}",
            })

    return _call_ai_multimodal(client, model, content, max_retries)


# ==================== 综合分析 ====================

def _build_speech_rhythm(transcription: str, audio: dict, meta: dict, keyframes: list) -> tuple[str, str]:
    """构建语音节奏分析和专业术语信息"""
    speech_rhythm = ""
    terms_info = ""

    if not transcription:
        return speech_rhythm, terms_info

    # 字数统计
    cn_chars = len(re.findall(r'[一-鿿]', transcription))
    en_words = len(re.findall(r'[a-zA-Z]+', transcription))
    total_chars = cn_chars + en_words

    # 有效语音时长
    silence_duration = sum(s["end"] - s["start"] for s in audio["silence"])
    speech_duration = meta["duration"] - silence_duration

    # 语速
    speech_rate = (total_chars / speech_duration * 60) if speech_duration > 0 else 0
    if speech_rate < 150:
        rate_eval = "偏慢，可能显得拖沓"
    elif speech_rate < 200:
        rate_eval = "适中"
    elif speech_rate < 260:
        rate_eval = "偏快，可能影响理解"
    else:
        rate_eval = "过快，听众难以跟上"

    # 停顿分析
    short_pauses = [s for s in audio["silence"] if 0.5 <= (s["end"] - s["start"]) <= 2]
    long_pauses = [s for s in audio["silence"] if (s["end"] - s["start"]) > 2]

    # 口头禅检测
    filler_words = ["然后", "就是", "这个", "那个", "嗯", "啊", "呃", "对吧", "是吧", "其实", "反正"]
    filler_counts = {fw: transcription.count(fw) for fw in filler_words if transcription.count(fw) >= 2}
    filler_info = ""
    if filler_counts:
        sorted_fillers = sorted(filler_counts.items(), key=lambda x: -x[1])
        filler_info = "\n- 口头禅: " + ", ".join(f"'{fw}'({cnt}次)" for fw, cnt in sorted_fillers[:5])

    speech_rhythm = f"""语音节奏分析：
- 语速: {speech_rate:.0f} 字/分钟 ({rate_eval})
- 有效语音时长: {speech_duration:.1f}s / 总时长 {meta['duration']:.1f}s
- 短停顿(0.5-2s): {len(short_pauses)} 次
- 长停顿(>2s): {len(long_pauses)} 次
- 总字数: {total_chars} (中文{cn_chars} + 英文{en_words}词){filler_info}"""

    # 专业术语提取
    all_text = transcription + " " + " ".join(kf.get("ocr_summary", "") for kf in keyframes)
    cn_terms = set(re.findall(r'[一-鿿]{4,8}', all_text))
    en_terms = set(t.lower() for t in re.findall(r'[A-Za-z]{3,}', all_text) if len(t) >= 4)
    common_words = {"这个", "那个", "就是", "然后", "可以", "应该", "因为", "所以", "如果", "但是"}
    cn_terms -= common_words

    if cn_terms or en_terms:
        terms_list = list(cn_terms)[:10] + list(en_terms)[:5]
        terms_info = f"\n- 识别到的专业词汇: {', '.join(terms_list)}"

    return speech_rhythm, terms_info


def _build_audio_info(audio: dict, meta: dict, speech_rhythm: str, terms_info: str) -> str:
    """构建音频分析信息"""
    silence_duration = sum(s["end"] - s["start"] for s in audio["silence"])
    speech_ratio = (meta["duration"] - silence_duration) / meta["duration"] * 100

    long_silences = [s for s in audio["silence"] if s["end"] - s["start"] > 3]
    silence_issues = ""
    if long_silences:
        silence_issues = "\n- 长静音段(>3s): " + ", ".join(
            f"{s['start']:.1f}-{s['end']:.1f}s({s['end']-s['start']:.1f}s)" for s in long_silences
        )

    mean_vol = audio['volume'].get('mean', -20)
    vol_issue = ""
    if mean_vol < -30:
        vol_issue = "\n- [警告] 平均音量过低，可能听不清"
    elif mean_vol > -5:
        vol_issue = "\n- [警告] 平均音量过高，可能失真"

    return f"""音频分析：
- 音量范围: {mean_vol} dB (均值) ~ {audio['volume'].get('max', 'N/A')} dB (最大){vol_issue}
- 静音段数量: {len(audio['silence'])}{silence_issues}
- 语音比例: 约{speech_ratio:.1f}%
- 视频总时长: {meta['duration']:.1f}秒
{speech_rhythm}
{terms_info}"""


def analyze_with_ai(client: OpenAI, model: str, local_data: dict, max_retries: int = 3) -> str:
    """调用 AI 模型进行综合分析"""
    meta = local_data["metadata"]
    audio = local_data["audio_analysis"]
    transcription = local_data.get("transcription")
    keyframes = local_data.get("keyframes", [])

    speech_rhythm, terms_info = _build_speech_rhythm(transcription, audio, meta, keyframes)
    audio_info = _build_audio_info(audio, meta, speech_rhythm, terms_info)

    keyframe_info = "关键帧内容：\n"
    for kf in keyframes:
        keyframe_info += f"- {kf['timestamp']}s: [OCR] {kf.get('ocr_summary', 'N/A')}\n"

    scene_desc = local_data.get("scene_description", "")
    transcription_info = f"语音转录内容:\n{transcription[:600]}" if transcription else "（语音转录不可用）"

    w, h = meta['width'], meta['height']
    if w >= 1920 or h >= 1080:
        res_level = "1080p+ 高清"
    elif w >= 1280 or h >= 720:
        res_level = "720p 标清"
    elif w > 0:
        res_level = "低分辨率"
    else:
        res_level = "未知"

    prompt = f"""请分析以下视频，用中文回答：

【视频元数据】
- 时长: {meta['duration']:.1f}秒
- 分辨率: {w}x{h} ({res_level})
- 帧率: {meta['fps']}fps

【音频分析】
{audio_info}

【关键帧 OCR】
{keyframe_info}

【画面场景描述】
{scene_desc}

【语音转录】
{transcription_info}

请回答：

一、内容总结
1. 视频主题（根据画面+语音综合判断）
2. 内容摘要（150字内）
3. 核心要点（3个）

二、缺陷分析
请从以下维度逐一检查，指出具体问题：
1. 【画面质量】分辨率、清晰度、色彩是否达标
2. 【音频质量】音量是否均衡、有无杂音/爆音、语音是否清晰
3. 【内容节奏】有无过长静音/空白段、节奏是否拖沓或过快
4. 【信息密度】关键信息是否突出、有无冗余画面
5. 【结构完整性】开头是否吸引人、结尾是否有总结、逻辑是否连贯

三、谈吐与节奏分析
根据语音节奏数据，重点分析：
1. 【语速控制】语速是否合适？过快/过慢如何调整？给出建议语速范围
2. 【停顿运用】停顿是否合理？哪里该停没停？哪里停顿过长？
3. 【口头禅问题】列出出现的口头禅，评估影响程度，给出替代方案
4. 【表达流畅度】是否有卡顿、重复、修正？如何提升？
5. 【语气与感染力】语调是否平淡？如何增强表现力？

四、专业知识理解评估
根据转录内容和OCR识别的专业词汇，评估：
1. 【专业术语使用】是否准确使用了领域术语？有无用错或缺失？
2. 【知识深度】讲解是否深入？有无停留在表面/泛泛而谈？
3. 【逻辑严谨性】论述是否有逻辑漏洞？因果关系是否成立？
4. 【知识准确性】有无明显的知识性错误或不准确表述？
5. 【专业度评级】整体专业水平评分（1-10），并说明理由

五、综合改进建议
针对以上所有问题，按优先级给出具体可执行的改进方案。"""

    return _call_ai(client, model, prompt, max_retries)


# ==================== 评判标准评分 ====================

def evaluate_with_criteria(client: OpenAI, model: str, analysis_result: str,
                           criteria_text: str, video_type: str, max_retries: int = 3) -> str:
    """根据评判标准对视频分析结果进行评分"""
    type_name = "答辩" if video_type == "defense" else "作品讲解"

    prompt = f"""你是一位专业的{type_name}视频评审专家。请根据以下【评判标准】对【视频分析结果】进行逐条评分和指导。

【评判标准】
{criteria_text}

【视频分析结果】
{analysis_result}

请严格按照评判标准的每个评分项，逐条进行评估，用中文回答：

一、逐项评分
对评判标准中的每个评分项，给出：
- 得分（X/满分）
- 得分依据（引用分析结果中的具体内容）
- 改进建议（具体可执行的操作）

格式示例：
1. [标准项名称] X/满分
   依据：...
   改进建议：...

二、总分汇总
总分：XX/100
等级：优秀(90+)/良好(80+)/中等(70+)/及格(60+)/不及格(<60)

三、多维度指导建议
从以下维度给出综合改进方案（每维度2-3条具体建议）：
1. 【内容层面】作品内容/研究内容的改进方向
2. 【表达层面】语言表达、谈吐节奏的提升方法
3. 【技术层面】技术深度、专业性的加强建议
4. 【结构层面】内容组织、逻辑结构的优化方案
5. {"【答辩技巧】答辩礼仪、应答策略、时间分配建议" if video_type == "defense" else "【演示技巧】演示流程、亮点展示、观众互动建议"}

四、核心改进优先级
列出最重要的3个改进点，按优先级排序：
1. 最紧迫：...
2. 次重要：...
3. 锦上添花：..."""

    return _call_ai(client, model, prompt, max_retries)
