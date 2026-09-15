'use client';

import { Eye, X } from '@react-zero-ui/icon-sprite';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DocumentViewer } from '@/components/document-viewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SignatureStatus {
  participantId: string;
  status: 'PENDING' | 'SIGNED' | 'DECLINED' | 'CANCELLED';
  participantName: string;
  participantEmail: string;
}

interface DocumentPreviewDialogProps {
  documentName: string;
  documentFilePath: string;
  annotations: any;
  signatureStatuses: SignatureStatus[];
  signedCount: number;
  totalSigners: number;
  compact?: boolean;
  documentId?: string;
  signedDocumentFilePath?: string | null;
}

export function DocumentPreviewDialog({
  documentName,
  documentFilePath,
  annotations,
  signatureStatuses,
  signedCount,
  totalSigners,
  compact = false,
  documentId,
  signedDocumentFilePath,
}: DocumentPreviewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  const handleOpen = () => {
    setViewerKey((k) => k + 1);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const viewerContent = isOpen ? (
    <div
      role="dialog"
      aria-label={`Preview of ${documentName}`}
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
        {/* Close button */}
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

        {/* Document viewer */}
        <div className="absolute inset-0 p-2" style={{ width: '100%', height: '100%' }}>
          <DocumentViewer
            key={`preview-${viewerKey}`}
            documentFilePath={documentFilePath}
            annotations={annotations}
            signatureStatuses={signatureStatuses}
            height="100%"
            isFinalized={signedCount === totalSigners && totalSigners > 0}
            documentId={documentId}
            signedDocumentFilePath={signedDocumentFilePath}
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        variant="outline"
        size={compact ? 'sm' : 'default'}
        className={
          compact
            ? ''
            : 'w-full justify-start gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        }
        onClick={handleOpen}
      >
        <Eye className={compact ? 'h-4 w-4 mr-2' : 'h-4 w-4'} />
        {compact ? 'Preview' : 'Preview Document'}
        {!compact && (
          <span className="ml-auto">
            {signedCount === totalSigners && totalSigners > 0 ? (
              <Badge variant="default" className="bg-green-600">
                All Signed
              </Badge>
            ) : (
              <Badge variant="outline">
                {signedCount}/{totalSigners} Signed
              </Badge>
            )}
          </span>
        )}
      </Button>

      {mounted && createPortal(viewerContent, document.body)}
    </>
  );
}
