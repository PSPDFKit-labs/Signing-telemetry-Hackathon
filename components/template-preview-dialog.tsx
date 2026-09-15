'use client';

import { Eye, X } from '@react-zero-ui/icon-sprite';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { getNutrientViewerRuntime, safeLoadViewer, safeUnloadViewer } from '@/lib/nutrient-viewer';

interface TemplatePreviewDialogProps {
  templateId: string;
  templateFilePath: string;
  templateName: string;
}

export function TemplatePreviewDialog({ templateId, templateFilePath, templateName }: TemplatePreviewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const viewerContent = isOpen ? (
    <div
      role="dialog"
      aria-label={`Preview of ${templateName}`}
      tabIndex={-1}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose();
      }}
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
    >
      <div
        role="document"
        className="relative bg-white dark:bg-zinc-900 w-[95%] h-[95%] rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="absolute right-4 top-4 z-[10000]">
          <Button
            variant="default"
            size="sm"
            className="rounded-full h-10 w-10 bg-zinc-800 hover:bg-zinc-700 text-white shadow-lg"
            onClick={handleClose}
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="absolute inset-0 p-2" style={{ width: '100%', height: '100%' }}>
          <TemplateViewer templateId={templateId} templateFilePath={templateFilePath} />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleOpen}
        title={`Preview ${templateName}`}
        aria-label={`Preview ${templateName}`}
      >
        <Eye className="h-4 w-4 text-muted-foreground" />
      </Button>

      {mounted && createPortal(viewerContent, document.body)}
    </>
  );
}

function TemplateViewer({ templateId, templateFilePath }: { templateId: string; templateFilePath: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);
  const isLoadingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;

    const loadViewer = async () => {
      if (isLoadingRef.current || !container || !isMounted) return;
      if (viewerInstanceRef.current) return;

      isLoadingRef.current = true;

      try {
        setError(null);

        const PSPDFKit = getNutrientViewerRuntime();
        if (!PSPDFKit) throw new Error('Nutrient Viewer SDK not loaded');

        safeUnloadViewer(container);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const docKey = templateFilePath.startsWith('http')
          ? new URL(templateFilePath).pathname.substring(1)
          : templateFilePath;

        const proxyUrl = `/api/documents/proxy?key=${encodeURIComponent(docKey)}&proxy=true&templateId=${encodeURIComponent(templateId)}`;

        if (!isMounted) {
          isLoadingRef.current = false;
          return;
        }

        const instance = await safeLoadViewer({
          container,
          document: proxyUrl,
          licenseKey: process.env.NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY,
          useCDN: true,
          isEditableAnnotation: () => false,
          toolbarItems: [
            { type: 'sidebar-thumbnails' },
            { type: 'pager' },
            { type: 'zoom-out' },
            { type: 'zoom-in' },
            { type: 'zoom-mode' },
            { type: 'spacer' },
            { type: 'print' },
          ],
          styleSheets: ['/styles/viewer.css'],
        });

        if (isMounted) {
          viewerInstanceRef.current = instance;
        }
      } catch (err) {
        console.error('Error loading template viewer:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load template';
        const isRaceCondition = errorMessage.includes('already used') || errorMessage.includes('not empty');
        if (isMounted && !isRaceCondition) {
          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          isLoadingRef.current = false;
        }
      }
    };

    loadViewer();

    return () => {
      isMounted = false;
      isLoadingRef.current = false;
      if (container) safeUnloadViewer(container);
      viewerInstanceRef.current = null;
    };
  }, [templateId, templateFilePath]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg border"
        style={{ width: '100%', height: '100%' }}
      >
        <div className="text-center p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="relative w-full h-full" />;
}
