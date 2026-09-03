import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { apiFetch } from '../api/client';
import type { AIJobStatusRecord, AssetRecord } from '../types';

type AIResult = {
  content?: string;
  data?: string;
  results?: Array<{ format: string; content: string }>;
  asset_ids?: string[];
};

interface AssetPreviewProps {
  asset?: AssetRecord | null;
  job?: AIJobStatusRecord | null;
  emptyMessage?: string;
  className?: string;
}

export function AssetPreview({ asset, job, emptyMessage = 'Your generated content will appear here instantly.', className = '' }: AssetPreviewProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const editor = useEditor({ extensions: [StarterKit], content: '', editable: false });

  useEffect(() => {
    if (!asset || asset.asset_type.toUpperCase() !== 'IMAGE' || !asset.storage_path) {
      setImagePreview(null);
      return;
    }
    void apiFetch<{ data: string }>(`/assets/${asset.id}/download`)
      .then((result) => setImagePreview(`data:image/png;base64,${result.data}`))
      .catch(() => setImagePreview(null));
  }, [asset?.id, asset?.asset_type, asset?.storage_path]);

  useEffect(() => {
    if (!editor) return;
    const content = asset?.content || extractTextFromJob(job);
    editor.commands.setContent(content || '');
  }, [asset?.id, asset?.content, job?.task_id, job?.status, editor]);

  if (job && ['QUEUED', 'RUNNING'].includes(job.status)) {
    return (
      <div className={`flex min-h-[320px] flex-col items-center justify-center gap-4 text-center ${className}`}>
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/30" />
        <div>
          <p className="font-display text-xl font-bold lowercase">{job.status === 'QUEUED' ? 'in queue…' : 'generating…'}</p>
          <p className="mt-1 text-sm text-white/70">
            {job.queue_position ? `Position ${job.queue_position} in queue` : 'Working on your request'}
          </p>
        </div>
      </div>
    );
  }

  if (job?.status === 'FAILED') {
    return (
      <div className={`rounded-xl bg-white/15 p-5 ${className}`}>
        <p className="font-bold text-white">Generation failed</p>
        <p className="mt-2 text-sm text-white/80">{job.error || 'Something went wrong. Please try again.'}</p>
      </div>
    );
  }

  const jobImage = extractImageFromJob(job);
  const isImage = asset?.asset_type.toUpperCase() === 'IMAGE' || Boolean(jobImage);

  if (isImage) {
    const src = imagePreview || jobImage;
    return (
      <div className={`flex min-h-[320px] items-center justify-center ${className}`}>
        {src ? (
          <img
            src={src}
            alt={asset?.title || asset?.name || 'Generated image'}
            className="max-h-[480px] max-w-full rounded-2xl object-contain shadow-cozy"
          />
        ) : (
          <p className="text-sm text-white/70">Loading image preview…</p>
        )}
      </div>
    );
  }

  const textContent = asset?.content || extractTextFromJob(job);
  if (textContent) {
    return (
      <div className={`min-h-[320px] ${className}`}>
        {asset ? (
          <div className="mb-4 border-b border-white/20 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">{asset.asset_type}</p>
            <h3 className="font-display text-2xl font-bold lowercase">{asset.title || asset.name}</h3>
          </div>
        ) : null}
        <div className="writing-editor max-h-[480px] overflow-auto rounded-xl bg-white/10 p-4 text-sm leading-relaxed text-white">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-[320px] flex-col items-center justify-center gap-3 text-center ${className}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl">✦</div>
      <p className="max-w-xs text-sm text-white/75">{emptyMessage}</p>
    </div>
  );
}

function extractTextFromJob(job?: AIJobStatusRecord | null): string {
  if (!job?.result) return '';
  if (typeof job.result === 'string') return job.result;
  const result = job.result as AIResult;
  if (typeof result.content === 'string') return result.content;
  if (result.results?.length) {
    return result.results.map((item) => `${item.format}\n${item.content}`).join('\n\n');
  }
  return '';
}

function extractImageFromJob(job?: AIJobStatusRecord | null): string | null {
  if (!job?.result || typeof job.result === 'string') return null;
  const result = job.result as AIResult;
  if (typeof result.data === 'string') return `data:image/png;base64,${result.data}`;
  return null;
}

export function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    QUEUED: 'bg-white/20 text-white',
    RUNNING: 'bg-accent text-text animate-pulse',
    COMPLETED: 'bg-white/30 text-white',
    FAILED: 'bg-statusError/80 text-white',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${styles[status] || styles.QUEUED}`}>
      {status}
    </span>
  );
}
