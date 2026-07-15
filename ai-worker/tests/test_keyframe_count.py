import json
import base64
import asyncio
from pathlib import Path
from subprocess import CompletedProcess

from app.modules.work_analysis import ai_analyzer
from app.modules.work_analysis import frame_extractor
from app.modules.work_analysis.router import analyze_work_async, work_manager
from app.modules.work_analysis.handler import detect_file_type
from app.modules.work_analysis.schemas import WorkAnalysisRequest


def test_image_file_type_and_camel_case_paths() -> None:
    request = WorkAnalysisRequest.model_validate({
        "fileName": "作品封面.png",
        "filePath": "/tmp/作品封面.png",
        "imagePaths": ["/tmp/作品封面.png", "/tmp/作品详情.jpg"],
    })

    assert detect_file_type(request.file_path) == "image"
    assert request.image_paths == ["/tmp/作品封面.png", "/tmp/作品详情.jpg"]


def test_async_router_preserves_all_camel_case_image_paths(
    monkeypatch,
    tmp_path: Path,
) -> None:
    image_path = tmp_path / "first.jpg"
    image_path.write_bytes(b"image")
    captured_request = None

    async def fake_submit(request):
        nonlocal captured_request
        captured_request = request
        return "task-1"

    monkeypatch.setattr(work_manager, "submit_task", fake_submit)

    response = asyncio.run(analyze_work_async({
        "fileName": "first.jpg",
        "filePath": str(image_path),
        "imagePaths": [str(image_path), str(tmp_path / "second.jpg")],
    }))

    assert response["task_id"] == "task-1"
    assert captured_request.image_paths == [
        str(image_path),
        str(tmp_path / "second.jpg"),
    ]


def test_vision_analysis_uses_the_embedded_image_mime_type(
    monkeypatch,
    tmp_path: Path,
) -> None:
    image_path = tmp_path / "frame.png"
    image_path.write_bytes(base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
        "AAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WQAAAABJRU5ErkJggg=="
    ))
    captured_content: list[dict] = []

    def fake_call(_client, _model, content, **_kwargs):
        captured_content.extend(content)
        return "图片分析"

    monkeypatch.setattr(ai_analyzer, "_call_ai_multimodal", fake_call)

    ai_analyzer.describe_keyframes_with_ai(
        object(),
        "test-model",
        [frame_extractor.Keyframe(index=0, timestamp=0, path=str(image_path))],
    )

    assert captured_content[1]["image_url"].startswith("data:image/png;base64,")


def test_vision_analysis_sends_images_in_batches_of_four(monkeypatch, tmp_path: Path) -> None:
    calls: list[list[dict]] = []
    progress: list[tuple[int, int]] = []
    frames = []
    for index in range(9):
        image_path = tmp_path / f"frame-{index}.jpg"
        image_path.write_bytes(b"image")
        frames.append(frame_extractor.Keyframe(index=index, timestamp=index, path=str(image_path)))

    def fake_call(_client, _model, content, **_kwargs):
        calls.append(content)
        return "批次分析"

    monkeypatch.setattr(ai_analyzer, "_call_ai_multimodal", fake_call)

    result = ai_analyzer.describe_keyframes_with_ai(
        object(),
        "test-model",
        frames,
        batch_progress=lambda current, total: progress.append((current, total)),
    )

    assert len(calls) == 3
    assert [len(call) - 1 for call in calls] == [4, 4, 1]
    assert "图5" in calls[1][0]["text"]
    assert result.count("【视觉证据第") == 3
    assert progress == [(1, 3), (2, 3), (3, 3)]


def test_interval_extraction_returns_requested_timeline_frames(
    monkeypatch,
    tmp_path: Path,
) -> None:
    def fake_run(command, **_kwargs):
        if command[0] == "ffprobe":
            return CompletedProcess(
                command,
                0,
                stdout=json.dumps({"format": {"duration": "5.0"}}),
                stderr="",
            )

        output_path = Path(command[-2])
        output_path.write_bytes(b"frame")
        return CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(frame_extractor.subprocess, "run", fake_run)

    frames = frame_extractor._extract_by_interval(
        "short-static-video.mp4",
        tmp_path,
        interval=2.0,
        max_frames=12,
    )

    assert len(frames) == 12
    assert frames[0].timestamp == 0
    assert frames[-1].timestamp < 5
    assert len({frame.timestamp for frame in frames}) == 12


def test_hybrid_extraction_keeps_late_timeline_frames(
    monkeypatch,
    tmp_path: Path,
) -> None:
    scene_frames = [
        frame_extractor.Keyframe(index=index, timestamp=float(index), change_score=0.8)
        for index in range(12)
    ]
    timeline_frames = [
        frame_extractor.Keyframe(index=index, timestamp=float(index * 10))
        for index in range(12)
    ]

    monkeypatch.setattr(
        frame_extractor,
        "_extract_by_scene_change",
        lambda *_args: scene_frames,
    )
    monkeypatch.setattr(
        frame_extractor,
        "_extract_by_interval",
        lambda *_args: timeline_frames,
    )

    frames = frame_extractor.extract_keyframes_ffmpeg(
        "long-video.mp4",
        tmp_path,
        method="hybrid",
        max_frames=12,
    )

    assert len(frames) == 12
    assert frames[-1].timestamp == 110


def test_scene_change_frame_paths_match_their_timestamps(
    monkeypatch,
    tmp_path: Path,
) -> None:
    def fake_run(command, **_kwargs):
        output_pattern = Path(command[-2])
        output_pattern.parent.mkdir(parents=True, exist_ok=True)
        (output_pattern.parent / "scene_0001.jpg").write_bytes(b"first")
        (output_pattern.parent / "scene_0002.jpg").write_bytes(b"second")
        return CompletedProcess(
            command,
            0,
            stdout="",
            stderr="pts_time:3.0 scene:0.8\npts_time:8.0 scene:0.9",
        )

    monkeypatch.setattr(frame_extractor.subprocess, "run", fake_run)

    frames = frame_extractor._extract_by_scene_change(
        "video.mp4",
        tmp_path,
        threshold=0.3,
        max_frames=2,
    )

    assert [frame.timestamp for frame in frames] == [3.0, 8.0]
    assert [Path(frame.path).name for frame in frames] == [
        "scene_0001.jpg",
        "scene_0002.jpg",
    ]
