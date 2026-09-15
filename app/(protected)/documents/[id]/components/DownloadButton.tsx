'use client';

import { normalizeViewerJson } from '@/lib/normalize-viewer-json';

import { Download, Loader2 } from '@react-zero-ui/icon-sprite';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { getNutrientViewerRuntime } from '@/lib/nutrient-viewer';

interface DownloadButtonProps {
  documentName: string;
  documentFilePath: string;
  annotations: Record<string, unknown> | null | undefined;
  signedDocumentFilePath?: string | null;
  documentId?: string;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function getProxyUrl(filePath: string, docId?: string): string {
  const key = filePath.startsWith('http') ? new URL(filePath).pathname.substring(1) : filePath;
  return `/api/documents/proxy?key=${encodeURIComponent(key)}&proxy=true${docId ? `&documentId=${encodeURIComponent(docId)}` : ''}`;
}

export function DownloadButton({
  documentName,
  documentFilePath,
  annotations,
  signedDocumentFilePath,
  documentId,
}: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const isDownloadingRef = useRef(false);

  const handleDownloadCurrent = async () => {
    if (isDownloadingRef.current) return;
    isDownloadingRef.current = true;
    setIsDownloading(true);
    let instance: { exportPDFWithOperations: (ops: unknown[]) => Promise<ArrayBuffer>; destroy?: () => void } | null =
      null;
    try {
      if (signedDocumentFilePath) {
        // Document is complete — download the DWS-signed PDF directly via proxy
        const proxyUrl = getProxyUrl(signedDocumentFilePath, documentId);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
        const blob = await response.blob();
        triggerBlobDownload(blob, documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`);
      } else {
        // Document still in progress — flatten and export via Nutrient SDK
        const PSPDFKit = getNutrientViewerRuntime();
        if (!PSPDFKit) throw new Error('Nutrient Viewer SDK not loaded');
        const proxyUrl = getProxyUrl(documentFilePath, documentId);
        // Strip border styling from annotations before flattening so form fields
        // (especially date fields) don't retain visible borders in the exported PDF
        let cleanedAnnotations = annotations ?? undefined;
        if (annotations) {
          cleanedAnnotations = { ...annotations } as Record<string, unknown>;
          if (Array.isArray((annotations as any).annotations)) {
            (cleanedAnnotations as any).annotations = (annotations as any).annotations.map((ann: any) => {
              if (ann.type === 'pspdfkit/widget' || ann.formFieldName) {
                const { borderColor, borderWidth, ...rest } = ann;
                return rest;
              }
              return ann;
            });
          }
        }
        instance = await PSPDFKit.load({
          headless: true,
          document: proxyUrl,
          instantJSON: cleanedAnnotations ? normalizeViewerJson(cleanedAnnotations as Record<string, unknown>) : undefined,
          licenseKey: process.env.NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY,
          useCDN: true,
        });
        if (!instance) throw new Error('Nutrient Viewer failed to initialize');
        const buffer = await instance.exportPDFWithOperations([{ type: 'flattenAnnotations' }]);
        const blob = new Blob([buffer], { type: 'application/pdf' });
        triggerBlobDownload(blob, documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`);
      }
    } catch (err) {
      console.error('Download (current) failed:', err);
      toast({
        title: 'Download failed',
        description: 'Could not export the document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (instance) {
        try {
          if (typeof instance.destroy === 'function') {
            instance.destroy();
          }
        } catch {
          // Suppress cleanup errors
        }
      }
      isDownloadingRef.current = false;
      setIsDownloading(false);
    }
  };

  const handleDownloadOriginal = async () => {
    if (isDownloadingRef.current) return;
    isDownloadingRef.current = true;
    setIsDownloading(true);
    try {
      const proxyUrl = getProxyUrl(documentFilePath, documentId);
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
      const blob = await response.blob();
      triggerBlobDownload(blob, documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`);
    } catch (err) {
      console.error('Download (original) failed:', err);
      toast({
        title: 'Download failed',
        description: 'Could not fetch the original document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      isDownloadingRef.current = false;
      setIsDownloading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDownloading} aria-label="Download document">
          {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDownloadCurrent} disabled={isDownloading}>
          Download (Current)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadOriginal} disabled={isDownloading}>
          Download (Original)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
