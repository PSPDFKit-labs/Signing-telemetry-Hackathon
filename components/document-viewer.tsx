'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ViewerErrorBoundary } from '@/components/viewer-error-boundary';
import { getNutrientViewerRuntime, safeLoadViewer, safeUnloadViewer } from '@/lib/nutrient-viewer';
import { createPreviewFieldRenderer } from '@/lib/preview-field-renderer';

interface InstantJSON {
  annotations?: Record<string, unknown>[];
  formFields?: Record<string, unknown>[];
  formFieldValues?: Record<string, string>;
  [key: string]: unknown;
}

function decodeBase64String(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

interface SignatureStatus {
  participantId: string;
  status: 'PENDING' | 'SIGNED' | 'DECLINED' | 'CANCELLED';
  participantName: string;
  participantEmail: string;
}

interface DocumentViewerProps {
  documentFilePath: string;
  annotations: InstantJSON | null;
  signatureStatuses: SignatureStatus[];
  height?: string;
  isFinalized?: boolean;
  documentId?: string;
  signedDocumentFilePath?: string | null;
}

export function DocumentViewer({
  documentFilePath,
  annotations,
  signatureStatuses,
  height = '600px',
  isFinalized = false,
  documentId,
  signedDocumentFilePath,
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null); // PSPDFKit viewer instance type not available
  const isLoadingRef = useRef(false);
  const certificatesRef = useRef<{ ca_certificates: string[]; certificates?: string[] } | null>(null);
  const [certificatesLoaded, setCertificatesLoaded] = useState(false);
  const [signaturesValid, setSignaturesValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch CA certificates and pre-check signature validity via headless mode
  useEffect(() => {
    if (!isFinalized || !signedDocumentFilePath) {
      setCertificatesLoaded(true);
      return;
    }

    let cancelled = false;

    const fetchAndPreCheck = async () => {
      try {
        // Fetch CA certificates
        const response = await fetch('/api/documents/certificates');
        if (response.ok) {
          const data = await response.json();
          certificatesRef.current = data;
        }

        if (cancelled) return;

        // Pre-check signature validity using headless mode
        const PSPDFKit = getNutrientViewerRuntime();
        if (PSPDFKit) {
          const signedKey = signedDocumentFilePath.startsWith('http')
            ? new URL(signedDocumentFilePath).pathname.substring(1)
            : signedDocumentFilePath;
          const signedDocUrl = `/api/documents/proxy?key=${encodeURIComponent(signedKey)}&proxy=true${documentId ? `&documentId=${encodeURIComponent(documentId)}` : ''}`;

          const certs = certificatesRef.current;
          const headlessConfig: Record<string, unknown> = {
            document: signedDocUrl,
            licenseKey: process.env.NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY,
            headless: true,
          };

          if (certs?.ca_certificates && certs.ca_certificates.length > 0) {
            const allCerts = [...certs.ca_certificates, ...(certs.certificates || [])];
            headlessConfig.trustedCAsCallback = async () => {
              return allCerts.map((cert: string) => decodeBase64String(cert));
            };
          }

          try {
            const headlessInstance = await PSPDFKit.load(headlessConfig);
            if (!cancelled) {
              const sigInfo = await headlessInstance.getSignaturesInfo();
              const sigInfoTyped = sigInfo as { signatures?: { certificateChainValidationStatus?: string }[] };
              const hasExpiredCert = sigInfoTyped?.signatures?.some(
                (sig) => sig.certificateChainValidationStatus === 'expired',
              );
              setSignaturesValid(!hasExpiredCert);
            }
            PSPDFKit.unload(headlessInstance);
          } catch (headlessErr) {
            console.warn('Headless signature pre-check failed:', headlessErr);
            // Default to not showing banner if pre-check fails
            if (!cancelled) setSignaturesValid(false);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch certificates for signature validation:', err);
      } finally {
        if (!cancelled) setCertificatesLoaded(true);
      }
    };

    fetchAndPreCheck();
    return () => {
      cancelled = true;
    };
  }, [isFinalized, signedDocumentFilePath, documentId]);

  // Memoize JSON stringification to prevent unnecessary re-renders
  const signatureStatusesJson = useMemo(() => JSON.stringify(signatureStatuses), [signatureStatuses]);

  useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;

    const loadViewer = async () => {
      if (isLoadingRef.current || !container || !isMounted || !certificatesLoaded) {
        return;
      }

      // Skip if viewer is already loaded on this container
      if (viewerInstanceRef.current) {
        return;
      }

      isLoadingRef.current = true;

      try {
        setError(null);

        const PSPDFKit = getNutrientViewerRuntime();
        if (!PSPDFKit) {
          throw new Error('Nutrient Viewer SDK not loaded');
        }

        // Ensure any existing instance is unloaded first
        safeUnloadViewer(container);

        // Wait a tick to ensure cleanup is complete
        await new Promise((resolve) => setTimeout(resolve, 0));

        const docKey = documentFilePath.startsWith('http')
          ? new URL(documentFilePath).pathname.substring(1)
          : documentFilePath;

        const proxyUrl = `/api/documents/proxy?key=${encodeURIComponent(docKey)}&proxy=true${documentId ? `&documentId=${encodeURIComponent(documentId)}` : ''}`;

        if (!isMounted) {
          isLoadingRef.current = false;
          return;
        }

        const parsedStatuses = JSON.parse(signatureStatusesJson) as SignatureStatus[];

        // For finalized documents with a signed PDF, load the signed PDF directly.
        // It already has all signatures, dates, and form values flattened in.
        const useSignedPdf = isFinalized && signedDocumentFilePath;

        let finalDocUrl = proxyUrl;
        if (useSignedPdf) {
          const signedKey = signedDocumentFilePath.startsWith('http')
            ? new URL(signedDocumentFilePath).pathname.substring(1)
            : signedDocumentFilePath;
          finalDocUrl = `/api/documents/proxy?key=${encodeURIComponent(signedKey)}&proxy=true${documentId ? `&documentId=${encodeURIComponent(documentId)}` : ''}`;
        }

        // For finalized documents without a signed PDF, keep all annotations
        // but mark every form field as readOnly so they render as static values
        let processedAnnotations = annotations;
        if (isFinalized && !useSignedPdf && annotations) {
          processedAnnotations = { ...annotations };

          if (annotations.formFields) {
            processedAnnotations.formFields = annotations.formFields.map((field: Record<string, unknown>) => ({
              ...field,
              readOnly: true,
            }));
          }
        }

        const viewerConfig: Parameters<typeof safeLoadViewer>[0] = {
          container,
          document: finalDocUrl,
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
        };

        // Only apply instantJSON when not using the signed PDF
        if (!useSignedPdf) {
          viewerConfig.instantJSON = processedAnnotations;
        }

        // Enable digital signature validation banner only if signatures are valid
        // (pre-checked via headless mode to avoid banner flash)
        if (useSignedPdf) {
          const NV = window.NutrientViewer as any; // PSPDFKit viewer instance type not available
          if (NV?.ViewState && NV?.ShowSignatureValidationStatusMode) {
            viewerConfig.initialViewState = new NV.ViewState({
              readOnly: true,
              showSignatureValidationStatus: signaturesValid
                ? NV.ShowSignatureValidationStatusMode.IF_SIGNED
                : NV.ShowSignatureValidationStatusMode.NEVER,
            });
          }

          const certs = certificatesRef.current;
          if (certs?.ca_certificates && certs.ca_certificates.length > 0) {
            const allCerts = [...certs.ca_certificates, ...(certs.certificates || [])];
            viewerConfig.trustedCAsCallback = async () => {
              return allCerts.map((cert: string) => decodeBase64String(cert));
            };
          }
        }

        if (isFinalized) {
          viewerConfig.formFieldsNotSavingSignatures = [];
          viewerConfig.inlineTextSelectionEnabled = true;
        } else {
          viewerConfig.customRenderers = {
            Annotation: createPreviewFieldRenderer({ signatureStatuses: parsedStatuses }),
          };
        }

        const instance = await safeLoadViewer(viewerConfig);

        if (isMounted) {
          viewerInstanceRef.current = instance;
        }
      } catch (err) {
        console.error('Error loading document viewer:', err);
        // Only set error if not a race condition (container already in use)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load document';
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
      if (container) {
        safeUnloadViewer(container);
      }
      viewerInstanceRef.current = null;
    };
  }, [
    documentFilePath,
    annotations,
    signatureStatusesJson,
    isFinalized,
    documentId,
    signedDocumentFilePath,
    certificatesLoaded,
    signaturesValid,
  ]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg border"
        style={{ width: '100%', height }}
      >
        <div className="text-center p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  // For percentage heights, we need the container to fill its parent
  const isPercentageHeight = height.includes('%');

  return (
    <ViewerErrorBoundary>
      <div
        ref={containerRef}
        className={isPercentageHeight ? 'relative w-full h-full' : 'relative rounded-lg overflow-hidden border'}
        style={isPercentageHeight ? undefined : { width: '100%', height }}
      />
    </ViewerErrorBoundary>
  );
}
