'use client';

import { X } from '@react-zero-ui/icon-sprite';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { safeLoadViewer, safeUnloadViewer } from '@/lib/nutrient-viewer';

interface DocumentViewerProps {
  documentUrl: string;
  documentId: string;
  /** Optional template id. When set, the proxy lookup goes through the templates table
   *  instead of the documents table — required for system/sample templates whose file
   *  path is not associated with any documents row. */
  templateId?: string;
  isOpen: boolean;
  preview?: boolean;
  onClose: () => void;
}

export default function DocumentViewer({
  documentUrl,
  documentId,
  templateId,
  isOpen,
  onClose,
  preview,
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isViewerLoaded, setIsViewerLoaded] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [_isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  // Ref to track loading state synchronously (prevents race conditions)
  const isLoadingRef = useRef(false);

  // Handle mounting for the portal - called on every render
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Effect to create proxy URL when dialog is visible - called on every render
  useEffect(() => {
    if (isOpen) {
      try {
        setIsLoading(true);
        setError(null);

        // Extract key from URL - improved handling
        let docKey: string;
        try {
          // Check if documentUrl is a full URL or just a key
          if (documentUrl.startsWith('http')) {
            const urlObj = new URL(documentUrl);
            docKey = urlObj.pathname.substring(1);
          } else {
            // Assume it's just the key
            docKey = documentUrl;
          }
        } catch (error) {
          console.error('Error parsing document URL:', error);
          throw new Error('Invalid document URL');
        }

        // Create proxy URL - no need for double encoding
        const lookupParam = templateId
          ? `&templateId=${encodeURIComponent(templateId)}`
          : documentId
            ? `&documentId=${encodeURIComponent(documentId)}`
            : '';
        const proxyEndpoint = `/api/documents/proxy?key=${encodeURIComponent(docKey)}&proxy=true${lookupParam}`;
        setProxyUrl(proxyEndpoint);

        // Update body to prevent scrolling while viewer is open
        document.body.style.overflow = 'hidden';

        // Handle Escape key to close
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            onClose();
          }
        };
        document.addEventListener('keydown', handleKeyDown);

        // Setup cleanup
        return () => {
          // Re-enable scrolling when component unmounts
          document.body.style.overflow = '';
          document.removeEventListener('keydown', handleKeyDown);

          // Reset loading ref
          isLoadingRef.current = false;

          // Unload viewer if it was loaded
          if (containerRef.current && isViewerLoaded) {
            safeUnloadViewer(containerRef.current);
            setIsViewerLoaded(false);
          }
        };
      } catch (error) {
        console.error('Error preparing document URL:', error);
        setError('Failed to prepare document for viewing');
      } finally {
        setIsLoading(false);
      }
    }
    // This effect is always called regardless of isOpen
    return () => {}; // Empty cleanup function when not open
  }, [isOpen, documentUrl, isViewerLoaded, templateId, onClose, documentId]);

  // Effect to load viewer once we have a proxy URL - called on every render
  useEffect(() => {
    if (isOpen && mounted && containerRef.current && proxyUrl) {
      // Skip if already loading or loaded (prevents race conditions)
      if (isLoadingRef.current || isViewerLoaded) {
        return;
      }

      const container = containerRef.current;
      const toolBarItems = preview
        ? [
            { type: 'sidebar-thumbnails' },
            { type: 'sidebar-document-outline' },
            { type: 'sidebar-annotations' },
            { type: 'sidebar-bookmarks' },
            { type: 'sidebar-signatures' },
            { type: 'sidebar-attachments' },
            { type: 'sidebar-layers' },
            { type: 'pager' },
            { type: 'pan' },
            { type: 'zoom-out' },
            { type: 'zoom-in' },
            { type: 'zoom-mode' },
            { type: 'spacer' },
          ]
        : [];

      // Set loading ref before async operation
      isLoadingRef.current = true;

      // Check if NutrientViewer is available
      safeLoadViewer({
        container,
        document: proxyUrl,
        toolbarItems: toolBarItems,
        licenseKey: process.env.NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY,
        useCDN: true,
      })
        .then(() => {
          setIsViewerLoaded(true);
          isLoadingRef.current = false;
        })
        .catch((err) => {
          console.error('Error loading document viewer:', err);
          // Only set error if not a race condition
          if (!err?.message?.includes('already used')) {
            setError('Failed to load document viewer');
          }
          isLoadingRef.current = false;
        });
    }
    // This effect is always called regardless of conditions
    return () => {}; // Empty cleanup function when conditions aren't met
  }, [isOpen, proxyUrl, mounted, preview, isViewerLoaded]);

  // Only render portal content when mounted
  if (!mounted) return null;

  // Create portal content
  const viewerContent = isOpen ? (
    <div
      role="dialog"
      aria-label="Document viewer"
      tabIndex={-1}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={() => onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
    >
      <div
        role="document"
        className="relative bg-white dark:bg-zinc-900 w-[95%] h-[95%] rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* More visible close button with contrasting background */}
        <div className="absolute right-4 top-4 z-[10000]">
          <Button
            variant="default"
            size="sm"
            className="rounded-full h-10 w-10 bg-zinc-800 hover:bg-zinc-700 text-white shadow-lg"
            onClick={onClose}
            aria-label="Close viewer"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-100/10 dark:bg-red-900/10 z-[9999]">
            <div className="text-red-700 dark:text-red-300 p-6 rounded-md bg-white dark:bg-zinc-800 shadow-lg">
              {error}
              <Button className="mt-4 w-full" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        <div
          id="nutrient-viewer-container"
          ref={containerRef}
          className="absolute inset-0 p-2"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  ) : null;

  // Use createPortal to mount the viewer to the document body
  return createPortal(viewerContent, document.body);
}
