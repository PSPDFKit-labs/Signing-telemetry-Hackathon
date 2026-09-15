'use client';

import { Download } from '@react-zero-ui/icon-sprite';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconDoc, IconEye, IconTemplates, IconTrashSmall } from '@/components/sign-design/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DocumentViewer from '@/components/ui/document-viewer';
import { FileUpload } from '@/components/ui/file-upload';
import { extractFileExtension, getFileTypeDisplay, getFileTypeIcon } from '@/lib/file-utils';

interface Template {
  id: string;
  name: string;
  type: string;
  size: string;
  modified: string;
  url?: string;
  key?: string;
}

interface FileData {
  url: string;
  name: string;
  file_type: string;
  size?: number;
}

const isValidFileType = (fileType: string): boolean => {
  const validMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/tiff',
  ];

  const validExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'tiff', 'tif'];

  // Check both MIME type and file extension
  return validMimeTypes.includes(fileType.toLowerCase()) || validExtensions.includes(fileType.toLowerCase());
};

const formatTemplate = (template: any): Template => {
  const fileExt = extractFileExtension(template.templateFilePath);
  const displayType = getFileTypeDisplay(fileExt);

  let formattedSize = 'N/A';
  if (template.size) {
    if (template.size < 1024) {
      formattedSize = `${template.size} B`;
    } else if (template.size < 1024 * 1024) {
      formattedSize = `${(template.size / 1024).toFixed(1)} KB`;
    } else {
      formattedSize = `${(template.size / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  return {
    id: template.id,
    name: template.name,
    type: displayType,
    size: formattedSize,
    modified: new Date(template.createdAt).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    url: template.templateFilePath,
  };
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [samples, setSamples] = useState<Template[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; id: string; isOpen: boolean } | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/templates');

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }

      const data = await response.json();
      const allTemplates: any[] = data.templates || [];
      const userTemplates = allTemplates.filter((t) => !t.isSystem);
      const sampleTemplates = allTemplates.filter((t) => t.isSystem);

      setTemplates(userTemplates.length > 0 ? userTemplates.map(formatTemplate) : []);
      setSamples(sampleTemplates.length > 0 ? sampleTemplates.map(formatTemplate) : []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load templates');
      setTemplates([]);
      setSamples([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch templates on page load
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle template upload
  const handleUploadComplete = async (fileData: FileData) => {
    try {
      // Get both MIME type and extension
      const mimeType = fileData.file_type;
      const fileExt = extractFileExtension(fileData.name);

      if (!isValidFileType(mimeType) && !isValidFileType(fileExt)) {
        throw new Error(
          'Unsupported file type. Please upload Word, Excel, PowerPoint, PDF, TIFF, JPG, or PNG files only.',
        );
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fileData.name,
          file_url: fileData.url,
          file_type: mimeType || fileExt,
          file_size: fileData.size || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save template to database');
      }

      await fetchTemplates();
      toast.success('Template uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload template');
    }
  };

  const handlePreview = async (template: Template) => {
    try {
      setPreviewDoc({
        url: template.url || '',
        id: template.id,
        isOpen: true,
      });
      setErrorMessage(null);
    } catch (error) {
      console.error('Preview error:', error);
      setErrorMessage('Failed to preview template. Please try again later.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleClosePreview = () => {
    setPreviewDoc(null);
  };

  // Helper function to extract template key from URL
  const extractTemplateKeyFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.substring(1);
      return path;
    } catch (error) {
      console.error('Error extracting template key:', error);
      return null;
    }
  };

  // Function to trigger file download
  const downloadFile = (url: string, fileName: string) => {
    setErrorMessage('Starting download...');

    const templateKey = extractTemplateKeyFromUrl(url);

    if (!templateKey) {
      setErrorMessage('Invalid template URL');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    const proxyUrl = `/api/templates/download/stream?key=${encodeURIComponent(templateKey)}`;

    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => setErrorMessage(null), 2000);
  };

  const handleDownload = async (template: Template) => {
    try {
      setErrorMessage('Preparing download...');

      const response = await fetch(`/api/templates/download?id=${template.id}`);

      if (!response.ok) {
        throw new Error(`Failed to prepare download: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No download URL returned');
      }

      downloadFile(data.url, template.name);
    } catch (error) {
      console.error('Download error:', error);
      setErrorMessage('Failed to download template. Please try again later.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleDeleteConfirm = async () => {
    const template = templateToDelete;
    if (!template) return;
    setTemplateToDelete(null);

    try {
      setErrorMessage('Deleting template...');

      const response = await fetch(`/api/templates/delete?id=${template.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        // Use the detailed message from the API if available
        throw new Error(data.message || data.error || 'Failed to delete template');
      }

      // Remove template from state
      setTemplates(templates.filter((t) => t.id !== template.id));
      setErrorMessage('Template deleted successfully');
      setTimeout(() => setErrorMessage(null), 2000);
    } catch (error) {
      console.error('Delete error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete template. Please try again later.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  return (
    <>
      <div className="app-page-head">
        <div>
          <h1 className="app-h1">Templates</h1>
          <p>Reusable documents you can send in seconds.</p>
        </div>
      </div>

      {previewDoc && (
        <DocumentViewer
          documentUrl={previewDoc.url}
          documentId={previewDoc.id}
          templateId={previewDoc.id}
          isOpen={previewDoc.isOpen}
          onClose={handleClosePreview}
          preview={true}
        />
      )}

      {errorMessage && (
        <div className="alert warn" style={{ marginBottom: 'var(--space-5)' }}>
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <div className="alert-body">{errorMessage}</div>
        </div>
      )}

      {/* Sample templates section */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-head">
          <h2>Sample templates</h2>
          <p>Start with one of our included samples.</p>
        </div>
        {samples.length === 0 ? (
          <div className="empty">
            <div className="icon">
              <IconDoc />
            </div>
            <h3>No sample templates available</h3>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="ico-cell">
                      <span className="file-ico">
                        <IconDoc />
                      </span>
                      <span className="doc-name">{t.name}</span>
                      <span className="tag" style={{ marginLeft: 8 }}>
                        Sample
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="tag">{t.type}</span>
                  </td>
                  <td className="mono" style={{ color: 'var(--ink-3)' }}>
                    {t.size}
                  </td>
                  <td className="actions">
                    <Link href={`/send?templateId=${t.id}`} className="btn ghost sm">
                      Use
                    </Link>
                    <button type="button" className="btn ghost sm" onClick={() => handlePreview(t)} title="Preview">
                      <IconEye />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Your templates section */}
      <div className="card">
        <div
          className="card-head"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}
        >
          <div>
            <h2>Your templates</h2>
            <p>Templates you&apos;ve saved.</p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <FileUpload onUploadComplete={handleUploadComplete} onError={setErrorMessage} />
          </div>
        </div>

        {isLoading ? (
          <div className="empty">
            <div className="icon">
              <IconTemplates />
            </div>
            <h3>Loading templates&hellip;</h3>
          </div>
        ) : templates.length === 0 ? (
          <div className="empty">
            <div className="icon">
              <IconTemplates />
            </div>
            <h3>No templates yet</h3>
            <p>Save any document as a template the next time you send for signature.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Modified</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>
                    <div className="ico-cell">
                      <span className="file-ico">
                        <IconDoc />
                      </span>
                      <span className="doc-name">{template.name}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {(() => {
                        const iconData = getFileTypeIcon(template.type);
                        return iconData.image ? (
                          <Image
                            src={iconData.image}
                            alt={template.type}
                            width={14}
                            height={14}
                            className={iconData.className}
                          />
                        ) : iconData.icon ? (
                          <iconData.icon className={iconData.className} />
                        ) : null;
                      })()}
                      <span className="tag">{template.type}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ color: 'var(--ink-3)' }}>
                    {template.size}
                  </td>
                  <td className="mono" style={{ color: 'var(--ink-3)' }}>
                    {template.modified}
                  </td>
                  <td className="actions">
                    <Link href={`/send?templateId=${template.id}`} className="btn ghost sm">
                      Use
                    </Link>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => handlePreview(template)}
                      title="Preview"
                    >
                      <IconEye />
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => handleDownload(template)}
                      title="Download"
                    >
                      <Download style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setTemplateToDelete(template)}
                      title="Delete"
                      style={{ color: 'rgb(180, 60, 60)' }}
                    >
                      <IconTrashSmall />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AlertDialog
        open={!!templateToDelete}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this template?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
