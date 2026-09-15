import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { safeUnloadViewer } from '@/lib/nutrient-viewer';

interface UseViewerSetupOptions {
  documentUrl?: string;
  documentId?: string;
  templateId?: string;
}

export function useViewerSetup({ documentUrl, documentId, templateId }: UseViewerSetupOptions) {
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const [isViewerLoaded, setIsViewerLoaded] = useState(false);
  // Ref to track loading state synchronously (prevents race conditions in React Strict Mode)
  const isLoadingViewerRef = useRef(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  // Ref for external cleanup (set by touch handling in main component)
  const windowListenerCleanupRef = useRef<(() => void) | null>(null);

  // CRITICAL: Prevent viewer loading before isMobile has hydrated.
  // useIsMobile() returns !!undefined = false on SSR/first render, then flips
  // to the real value after its useEffect runs. Loading the viewer before this
  // settles causes the SDK to initialize into the wrong container, corrupting
  // its internal state (GdPicture licensing error on retry).
  const [isMobileSettled, setIsMobileSettled] = useState(false);

  // Track previous isMobile value to detect transitions
  const prevIsMobileRef = useRef(isMobile);

  // Handle mounting — also marks isMobile as settled after the first effect
  // cycle, when useIsMobile's own effect has already resolved the real value.
  useEffect(() => {
    setMounted(true);
    setIsMobileSettled(true);
    return () => setMounted(false);
  }, []);

  // When isMobile changes (e.g. hydration: false→true), unload the viewer from
  // BOTH containers so the SDK is fully clean for the next load attempt.
  useEffect(() => {
    if (prevIsMobileRef.current === isMobile) return;
    prevIsMobileRef.current = isMobile;

    // Always try to clean up, even if the load hasn't completed yet.
    // The first load attempt may have left the SDK in a half-initialized state.
    if (typeof window !== 'undefined' && window.NutrientViewer) {
      // Unload from both containers to ensure clean state
      if (desktopContainerRef.current) {
        safeUnloadViewer(desktopContainerRef.current);
      }
      if (mobileContainerRef.current) {
        safeUnloadViewer(mobileContainerRef.current);
      }
    }

    // Clean up window-level event listeners (touch handlers)
    if (windowListenerCleanupRef.current) {
      windowListenerCleanupRef.current();
      windowListenerCleanupRef.current = null;
    }

    // Reset state so the viewer-init effect will re-run
    isLoadingViewerRef.current = false;
    setIsViewerLoaded(false);
  }, [isMobile]);

  // Proxy URL construction + cleanup
  useEffect(() => {
    if (!documentUrl) {
      setError('No document selected. Please go back and select a document.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Extract key from URL
      let docKey: string;
      try {
        if (documentUrl.startsWith('http')) {
          const urlObj = new URL(documentUrl);
          docKey = urlObj.pathname.substring(1);
        } else {
          docKey = documentUrl;
        }
      } catch (error) {
        console.error('Error parsing document URL:', error);
        throw new Error('Invalid document URL');
      }

      // Create proxy URL — include documentId/templateId when available so the
      // proxy uses a reliable ID-based lookup instead of the fragile LIKE query
      // on the file path (which can match the wrong document and return 403).
      let proxyEndpoint = `/api/documents/proxy?key=${encodeURIComponent(docKey)}&proxy=true`;
      if (documentId) {
        proxyEndpoint += `&documentId=${encodeURIComponent(documentId)}`;
      } else if (templateId) {
        proxyEndpoint += `&templateId=${encodeURIComponent(templateId)}`;
      }
      setProxyUrl(proxyEndpoint);
    } catch (error) {
      console.error('Error preparing document URL:', error);
      setError('Failed to prepare document for viewing');
    } finally {
      setIsLoading(false);
    }

    return () => {
      // Reset loading ref on cleanup
      isLoadingViewerRef.current = false;

      // Clean up window-level event listeners
      if (windowListenerCleanupRef.current) {
        windowListenerCleanupRef.current();
        windowListenerCleanupRef.current = null;
      }

      // Cleanup viewer when component unmounts
      if (typeof window !== 'undefined' && window.NutrientViewer && isViewerLoaded) {
        if (desktopContainerRef.current) {
          safeUnloadViewer(desktopContainerRef.current);
        }
        if (mobileContainerRef.current) {
          safeUnloadViewer(mobileContainerRef.current);
        }
        setIsViewerLoaded(false);
      }
    };
  }, [documentUrl, documentId, templateId, isViewerLoaded]);

  return {
    desktopContainerRef,
    mobileContainerRef,
    isViewerLoaded,
    setIsViewerLoaded,
    isLoadingViewerRef,
    proxyUrl,
    isLoading,
    setIsLoading,
    error,
    setError,
    mounted,
    isMobile,
    isMobileSettled,
    windowListenerCleanupRef,
  };
}
