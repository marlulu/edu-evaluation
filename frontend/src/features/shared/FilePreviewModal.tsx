import { Button, Empty, Modal, Spin } from 'antd';
import axios from 'axios';
import mammoth from 'mammoth';
import { useEffect, useState } from 'react';

type SubmissionPreviewData = { fileName: string; contentType: string; previewUrl: string };

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|json|xml|yaml|yml|toml|ini|cfg|conf|log|rtf|html?|css|less|scss|js|jsx|ts|tsx|py|java|c|cpp|h|hpp|cs|go|rs|rb|php|sql|sh|bat|cmd|ps1|swift|kt|r|lua|pl|ex|exs|hs|ml|scala|groovy|gradle|properties|env|gitignore|dockerfile|makefile|cmake)$/i;

export function isPreviewable(fileName: string): boolean {
  const ext = fileName.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  return /\.(mp4|webm|ogg|mp3|wav|pdf|png|jpe?g|gif|bmp|svg|docx)$/.test(ext) || TEXT_EXTENSIONS.test(ext);
}

export function getPreviewCategory(fileName: string): 'video' | 'audio' | 'pdf' | 'image' | 'word' | 'text' | 'unknown' {
  const ext = fileName.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  if (/\.(mp4|webm|ogg)$/.test(ext)) return 'video';
  if (/\.(mp3|wav)$/.test(ext)) return 'audio';
  if (ext === '.pdf') return 'pdf';
  if (/\.(png|jpe?g|gif|bmp|svg)$/.test(ext)) return 'image';
  if (ext === '.docx') return 'word';
  if (TEXT_EXTENSIONS.test(ext)) return 'text';
  return 'unknown';
}

export function FilePreviewModal({ open, onClose, submissionId, fileName, archiveEntry }: { open: boolean; onClose: () => void; submissionId: string | null; fileName: string; archiveEntry?: string }) {
  const [preview, setPreview] = useState<SubmissionPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const displayFileName = archiveEntry ?? fileName;
  const category = getPreviewCategory(displayFileName);

  useEffect(() => {
    if (!open || !submissionId) { setPreview(null); setDocxHtml(null); setDocxError(null); setTextContent(null); return; }
    setLoading(true);
    setPreview(null);
    setDocxHtml(null);
    setDocxError(null);
    setTextContent(null);
    const url = archiveEntry
      ? `/api/submissions/${submissionId}/archive-preview?entry=${encodeURIComponent(archiveEntry)}`
      : `/api/submissions/${submissionId}/preview`;
    const fetchFn = axios.get(url, { responseType: 'blob' }).then((res) => {
      const blob = res.data as Blob;
      const previewUrl = URL.createObjectURL(blob);
      const contentType = res.headers['content-type'] ?? blob.type ?? 'application/octet-stream';
      return { fileName: displayFileName, contentType, previewUrl } as SubmissionPreviewData;
    });
    fetchFn
      .then(async (data) => {
        setPreview(data);
        if (category === 'word') {
          try {
            const response = await fetch(data.previewUrl);
            const arrayBuffer = await response.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setDocxHtml(result.value);
          } catch {
            setDocxError('Word 文档预览失败，请下载查看');
          }
        } else if (category === 'text') {
          try {
            const response = await fetch(data.previewUrl);
            const text = await response.text();
            setTextContent(text);
          } catch {
            setDocxError('文本文件读取失败');
          }
        }
      })
      .catch(() => setDocxError('预览加载失败'))
      .finally(() => setLoading(false));
  }, [open, submissionId, category, archiveEntry, displayFileName]);

  const renderPreview = () => {
    if (loading) return <div className="file-preview-loading"><Spin tip="加载预览中..." /></div>;
    if (!preview) return <Empty description="无法加载预览" />;
    switch (category) {
      case 'video':
        return <video controls className="file-preview-media" src={preview.previewUrl}>
          您的浏览器不支持视频播放
        </video>;
      case 'audio':
        return <div className="file-preview-audio-wrapper"><audio controls src={preview.previewUrl}>
          您的浏览器不支持音频播放
        </audio></div>;
      case 'pdf':
        return <iframe className="file-preview-iframe" src={preview.previewUrl} title={displayFileName} />;
      case 'image':
        return <img className="file-preview-image" src={preview.previewUrl} alt={displayFileName} />;
      case 'word':
        if (docxError) return <Empty description={docxError} />;
        if (docxHtml === null) return <div className="file-preview-loading"><Spin tip="解析文档中..." /></div>;
        return <div className="file-preview-docx" dangerouslySetInnerHTML={{ __html: docxHtml }} />;
      case 'text':
        if (docxError) return <Empty description={docxError} />;
        if (textContent === null) return <div className="file-preview-loading"><Spin tip="读取文件中..." /></div>;
        return <pre className="file-preview-text">{textContent}</pre>;
      default:
        return <Empty description="该文件类型暂不支持预览，请下载查看" />;
    }
  };

  return <Modal
    open={open}
    title={`预览：${displayFileName}`}
    onCancel={onClose}
    width={category === 'video' ? 800 : 720}
    footer={<Button onClick={onClose}>关闭</Button>}
    destroyOnHidden
  >
    <div className="file-preview-container">{renderPreview()}</div>
  </Modal>;
}
