'use client';

import { useRef, useState } from 'react';
import { IconDoc, IconUpload } from '@/components/sign-design/icons';
import type { PacketManifest } from '@/lib/document-packets';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PACKET_DOCUMENTS = 25;

export interface PacketUploadResult {
  url: string;
  name: string;
  size: number;
  packetManifest: PacketManifest;
}

interface PacketUploadProps {
  onUploadComplete: (result: PacketUploadResult) => void;
  onError: (message: string) => void;
}

export function PacketUpload({ onUploadComplete, onError }: PacketUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(0);

  const selectFiles = (selected: File[]) => {
    if (selected.length === 0) return;
    if (selected.length > MAX_PACKET_DOCUMENTS) {
      onError(`A packet can contain at most ${MAX_PACKET_DOCUMENTS} PDFs.`);
      return;
    }
    const invalid = selected.find(
      (file) => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'),
    );
    if (invalid) {
      onError(`${invalid.name} is not a PDF.`);
      return;
    }
    const oversized = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      onError(`${oversized.name} exceeds the 50MB per-document limit.`);
      return;
    }
    setFiles(selected);
    setCompleted(0);
  };

  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= files.length) return;
    setFiles((current) => {
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  };

  const upload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setCompleted(0);
    try {
      const uploaded: Array<{ url: string; name: string; size: number }> = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new Error(result.error || `Failed to upload ${file.name}`);
        uploaded.push({ url: result.url, name: file.name, size: file.size });
        setCompleted(uploaded.length);
      }

      const title =
        files.length === 1 ? files[0].name.replace(/\.pdf$/i, '') : `${files[0].name.replace(/\.pdf$/i, '')} packet`;
      const response = await fetch('/api/documents/packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, files: uploaded }),
      });
      const packet = (await response.json()) as PacketUploadResult & { error?: string };
      if (!response.ok) throw new Error(packet.error || 'Failed to assemble packet');
      onUploadComplete(packet);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to upload packet');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: 'var(--space-4)' }} aria-label="Signing packet upload">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
      />

      {files.length === 0 ? (
        <button
          type="button"
          className="empty"
          style={{ width: '100%', cursor: 'pointer', borderStyle: 'dashed' }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="icon">
            <IconUpload />
          </span>
          <strong>Choose one or more PDFs</strong>
          <span>They will be combined in this order into one signing envelope.</span>
        </button>
      ) : (
        <>
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-2)', overflow: 'hidden' }}>
            {files.map((file, index) => (
              <div
                key={`${file.name}-${file.lastModified}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px minmax(0, 1fr) auto',
                  gap: 'var(--space-3)',
                  alignItems: 'center',
                  padding: 'var(--space-3)',
                  borderTop: index === 0 ? 'none' : '1px solid var(--line)',
                }}
              >
                <span style={{ color: 'var(--brand-accent)' }}>
                  <IconDoc />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {index + 1}. {file.name}
                  </strong>
                  <span className="hint">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="btn ghost sm" onClick={() => move(index, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => move(index, 1)}
                    disabled={index === files.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div
            style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span className="hint">
              {uploading
                ? `Uploaded ${completed} of ${files.length}`
                : `${files.length} document${files.length === 1 ? '' : 's'} selected locally. Upload to enable Next.`}
            </span>
            <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                Replace
              </button>
              <button type="button" className="btn primary" onClick={upload} disabled={uploading}>
                <IconUpload /> {uploading ? 'Building packet…' : 'Upload selected document'}
              </button>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
