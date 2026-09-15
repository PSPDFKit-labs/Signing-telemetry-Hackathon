'use client';

import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';
import { IconCheck, IconDoc, IconUpload } from '@/components/sign-design/icons';
import { extractFileExtension } from '@/lib/file-utils';

// Valid file types
const VALID_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/tiff',
  'image/jpeg',
];

const VALID_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.tiff', '.jpg', '.jpeg'];

// Max file size (50MB in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface FileUploadProps {
  onUploadComplete: (fileData: { url: string; name: string; file_type: string; size?: number }) => void;
  onError?: (message: string) => void;
  saveAsTemplate?: boolean;
  onSaveAsTemplateChange?: (checked: boolean) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Shared PDF file tile
function FileTile({ ext }: { ext: string }) {
  return (
    <div
      style={{
        width: 44,
        height: 56,
        borderRadius: 4,
        background: 'var(--brand-accent-tint)',
        color: 'var(--brand-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '.04em',
        position: 'relative',
      }}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: 'absolute', top: 8 }}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <span style={{ position: 'absolute', bottom: 6 }}>{ext.toUpperCase()}</span>
    </div>
  );
}

export function FileUpload({
  onUploadComplete,
  onError,
  saveAsTemplate = false,
  onSaveAsTemplateChange,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    url: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = (selectedFile: File) => {
    const fileExtension = `.${selectedFile.name.split('.').pop()?.toLowerCase()}`;

    if (!VALID_FILE_TYPES.includes(selectedFile.type) && !VALID_EXTENSIONS.includes(fileExtension)) {
      onError?.('Invalid file type. Please select a valid document format.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      onError?.('File size exceeds the 50MB limit.');
      return;
    }

    setUploadedFile(null);
    setFile(selectedFile);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) selectFile(e.target.files[0]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) selectFile(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      onError?.('No file selected. Please select a file to upload.');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const result = JSON.parse(xhr.responseText) as { url: string };
          setUploadedFile({
            name: file.name,
            size: file.size,
            url: result.url,
          });

          onUploadComplete({
            url: result.url,
            name: file.name,
            file_type: file.type,
            size: file.size,
          });

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setFile(null);
          setUploading(false);
        } else {
          let message = `Upload failed: ${xhr.statusText}`;
          try {
            message = JSON.parse(xhr.responseText).error || message;
          } catch {
            // Keep the HTTP status message when the response is not JSON.
          }
          onError?.(message);
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        onError?.('Network error occurred during upload.');
        setUploading(false);
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    } catch (error) {
      console.error('Error uploading file:', error);
      onError?.('An unexpected error occurred.');
      setUploading(false);
    }
  };

  const resetFileState = () => {
    setFile(null);
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Shared save-as-template checkbox (only renders when onSaveAsTemplateChange is provided)
  const templateCheckbox = onSaveAsTemplateChange ? (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        fontSize: 'var(--text-sm)',
        color: 'var(--ink-2)',
        marginLeft: 'auto',
      }}
    >
      <input
        type="checkbox"
        checked={saveAsTemplate}
        onChange={(e) => onSaveAsTemplateChange(e.target.checked)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          width: 16,
          height: 16,
          border: `1.5px solid ${saveAsTemplate ? 'var(--brand-accent)' : 'var(--line-strong)'}`,
          borderRadius: 3,
          background: saveAsTemplate ? 'var(--brand-accent)' : 'var(--bg-elev)',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
      <span>Save as template for future use</span>
    </label>
  ) : null;

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept={VALID_FILE_TYPES.join(',')}
      />

      {/* ── Stage A: No file selected — dashed dropzone ───────────── */}
      {!file && !uploadedFile && (
        <section
          aria-label="File upload drop zone"
          onDragOver={(e) => {
            e.preventDefault();
            if (!isDraggingOver) setIsDraggingOver(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            // Ignore leave events that move into a child element
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setIsDraggingOver(false);
          }}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${isDraggingOver ? 'var(--brand-accent)' : 'var(--line-strong)'}`,
            borderRadius: 'var(--r-2)',
            padding: 'var(--space-7)',
            textAlign: 'center',
            background: isDraggingOver ? 'var(--brand-accent-tint)' : 'var(--surface)',
            transition: 'border-color .15s var(--ease), background .15s var(--ease)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--r-2)',
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-3)',
              }}
            >
              <IconUpload width={20} height={20} />
            </div>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--ink)' }}>Drop a document here</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginTop: 4 }}>
                or click to upload — up to 50 MB
              </div>
            </div>
            <button
              type="button"
              className="btn sm"
              style={{ marginTop: 8 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload />
              Choose file
            </button>
          </div>
        </section>
      )}

      {/* ── Stage B: File selected, not yet uploaded ──────────────── */}
      {file && (
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-2)',
            padding: 'var(--space-4) var(--space-5)',
            background: 'var(--bg-elev)',
          }}
        >
          {/* Top row: tile + filename + meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <FileTile ext={extractFileExtension(file.name) || 'doc'} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: 'var(--ink)',
                  fontWeight: 500,
                  fontSize: 'var(--text-sm)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {file.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 6,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '.04em',
                }}
              >
                <span>{formatFileSize(file.size)}</span>
                <span style={{ opacity: 0.4 }}>&middot;</span>
                <span
                  style={{
                    color: 'rgb(40, 130, 80)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconCheck width={11} height={11} />
                  Ready to upload
                </span>
              </div>
            </div>
          </div>

          {/* Divider + action row */}
          <div
            style={{
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              alignItems: 'center',
            }}
          >
            {uploading ? (
              /* Progress bar while uploading */
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    height: 6,
                    background: 'var(--bg-elev)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--brand-accent)',
                      width: `${progress}%`,
                      transition: 'width .2s',
                    }}
                  />
                </div>
                <p className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', marginTop: 4 }}>
                  Uploading: {progress}%
                </p>
              </div>
            ) : (
              <>
                <button type="button" className="btn" onClick={handleUpload}>
                  <IconUpload />
                  Upload Now
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={resetFileState}
                  style={{
                    color: 'rgb(180, 60, 60)',
                    borderColor: 'color-mix(in srgb, rgb(180, 60, 60) 40%, var(--line))',
                  }}
                >
                  Cancel
                </button>
                {templateCheckbox}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Stage B-ish: Internally uploaded (templates-page consumer) ── */}
      {uploadedFile && !file && (
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-2)',
            padding: 'var(--space-4) var(--space-5)',
            background: 'var(--bg-elev)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <FileTile ext={extractFileExtension(uploadedFile.name) || 'doc'} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: 'var(--ink)',
                  fontWeight: 500,
                  fontSize: 'var(--text-sm)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {uploadedFile.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 6,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '.04em',
                }}
              >
                <span>{formatFileSize(uploadedFile.size)}</span>
                <span style={{ opacity: 0.4 }}>&middot;</span>
                <span
                  style={{
                    color: 'rgb(40, 130, 80)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconCheck width={11} height={11} />
                  Uploaded
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              alignItems: 'center',
            }}
          >
            <button type="button" className="btn ghost" onClick={() => fileInputRef.current?.click()}>
              <IconDoc />
              Select Different Document
            </button>
            {templateCheckbox}
          </div>
        </div>
      )}
    </>
  );
}
