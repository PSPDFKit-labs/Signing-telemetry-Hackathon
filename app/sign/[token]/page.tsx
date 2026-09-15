'use client';

import { CheckCircle, Loader2, ShieldAlert } from '@react-zero-ui/icon-sprite';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/sign-design/alert';
import SignHereWidget from '@/components/sign-here-widget';
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
import { toast } from '@/components/ui/use-toast';
import { ViewerErrorBoundary } from '@/components/viewer-error-boundary';
import { postSigningEmbedEvent } from '@/lib/embed-contract';
import { getNutrientViewerRuntime, safeLoadViewer, safeUnloadViewer } from '@/lib/nutrient-viewer';
import { createSignatureFieldRenderer } from '@/lib/signature-field-renderer';
import { signatureStorageKeys } from '@/lib/signature-storage';
import { hasRequiredFieldValue } from '@/lib/signing-fields';

interface DocumentData {
  id: string;
  name: string;
  filePath: string;
  expiresAt?: string;
}

interface RecipientData {
  id: string;
  name: string;
  email: string;
  accessLevel: string;
  signingOrder: number;
}

interface SignatureRequestData {
  id: string;
  status: string;
  requestedAt: string;
}

interface SigningData {
  sender: { name: string };
  finalizationAvailable?: boolean;
  document: DocumentData;
  recipient: RecipientData;
  signatureRequest: SignatureRequestData;
  annotations: Record<string, unknown> | null;
  participants: { id: string; name: string; email: string; accessLevel: string }[];
}

const isEmbeddedWindow = () => typeof window !== 'undefined' && window.parent !== window;

// Helper function to convert File/Blob to data URL
const fileToDataURL = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Setup signature storage for the viewer instance
// PSPDFKit instance and SDK types not available in TypeScript definitions
const setupSignatureStorage = async (instance: any, PSPDFKit: any, documentId: string, participantId: string) => {
  const { signatures: signatureStorageKey, attachments: attachmentStorageKey } = signatureStorageKeys(
    documentId,
    participantId,
  );
  // Keep reusable signatures only for this browser tab and recipient/document.
  try {
    const signaturesString = sessionStorage.getItem(signatureStorageKey);
    if (signaturesString) {
      const storedSignatures = JSON.parse(signaturesString);
      const list = PSPDFKit.Immutable.List(storedSignatures.map(PSPDFKit.Annotations.fromSerializableObject));
      instance.setStoredSignatures(list);
    }

    // Retrieve and load attachments
    const attachmentsString = sessionStorage.getItem(attachmentStorageKey);
    if (attachmentsString) {
      const attachmentsArray = JSON.parse(attachmentsString);
      const blobs = await Promise.all(
        attachmentsArray.map(({ url }: { url: string }) => fetch(url).then((res) => res.blob())),
      );
      for (const blob of blobs) {
        instance.createAttachment(blob);
      }
    }
  } catch (err) {
    console.error('Error loading stored signatures:', err);
  }

  // Listen for new signatures being stored
  instance.addEventListener('storedSignatures.create', async (annotation: any) => {
    try {
      const signaturesString = sessionStorage.getItem(signatureStorageKey);
      const storedSignatures = signaturesString ? JSON.parse(signaturesString) : [];

      const serializedAnnotation = PSPDFKit.Annotations.toSerializableObject(annotation);

      // Handle image attachments if present
      if (annotation.imageAttachmentId) {
        const attachment = await instance.getAttachment(annotation.imageAttachmentId);
        const url = await fileToDataURL(attachment);

        const attachmentsString = sessionStorage.getItem(attachmentStorageKey);
        const attachmentsArray = attachmentsString ? JSON.parse(attachmentsString) : [];
        attachmentsArray.push({ url, id: annotation.imageAttachmentId });
        sessionStorage.setItem(attachmentStorageKey, JSON.stringify(attachmentsArray));
      }

      storedSignatures.push(serializedAnnotation);
      sessionStorage.setItem(signatureStorageKey, JSON.stringify(storedSignatures));

      // Update the instance to show the signature in the UI
      instance.setStoredSignatures((signatures: any) => signatures.push(annotation));
    } catch (err) {
      console.error('Error saving signature to storage:', err);
    }
  });

  // Listen for signatures being deleted
  instance.addEventListener('storedSignatures.delete', (annotation: any) => {
    try {
      const signaturesString = sessionStorage.getItem(signatureStorageKey);
      const storedSignatures = signaturesString ? JSON.parse(signaturesString) : [];
      const annotations = storedSignatures.map(PSPDFKit.Annotations.fromSerializableObject);
      const updatedAnnotations = annotations.filter((currentAnnotation: any) => !currentAnnotation.equals(annotation));

      sessionStorage.setItem(
        signatureStorageKey,
        JSON.stringify(updatedAnnotations.map(PSPDFKit.Annotations.toSerializableObject)),
      );

      // Update the instance UI
      instance.setStoredSignatures((signatures: any) =>
        signatures.filter((signature: any) => !signature.equals(annotation)),
      );

      // Handle attachment deletion if present
      if (annotation.imageAttachmentId) {
        const attachmentsString = sessionStorage.getItem(attachmentStorageKey);
        if (attachmentsString) {
          let attachmentsArray = JSON.parse(attachmentsString);
          attachmentsArray = attachmentsArray.filter(
            (attachment: any) => attachment.id !== annotation.imageAttachmentId,
          );
          sessionStorage.setItem(attachmentStorageKey, JSON.stringify(attachmentsArray));
        }
      }
    } catch (err) {
      console.error('Error deleting signature from storage:', err);
    }
  });
};

/**
 * Adds a small text annotation below each of the current signer's signature
 * fields showing a truncated signing request ID. These annotations are created
 * right before flattening so they become permanent pixels in the final PDF.
 */
// PSPDFKit instance and SDK types not available in TypeScript definitions
const addSignerIdAnnotations = async (instance: any, PSPDFKit: any, recipientId: string, signingRequestId: string) => {
  // Format ID: strip hyphens, uppercase, take first 16 chars
  const displayId = signingRequestId.replace(/-/g, '').toUpperCase().substring(0, 16);

  const totalPages = await instance.totalPageCount;
  let allAnnotations: any[] = [];
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageAnnotations = await instance.getAnnotations(pageIndex);
    allAnnotations = allAnnotations.concat(pageAnnotations.toArray());
  }

  const formFields = await instance.getFormFields();

  for (const field of formFields) {
    // Only process signature fields (not initials, not date)
    const isSignatureField = field instanceof PSPDFKit.FormFields.SignatureFormField;
    if (!isSignatureField) continue;

    // Skip initials fields — both use SignatureFormField, but initials names start with "initials"
    if (field.name?.startsWith('initials')) continue;

    // Check if this field has a signature (overlapping annotation)
    const overlapping = await instance.getOverlappingAnnotations(field);
    if (overlapping.size === 0) continue;

    // Find the widget annotation for this field
    const widget = allAnnotations.find((ann: any) => ann.formFieldName === field.name);
    if (!widget?.customData) continue;

    // Only add ID for current signer's fields
    const signerID = widget.customData.signerID;
    if (!signerID || signerID !== recipientId) continue;

    // Position the ID text just below the signature field
    const bbox = widget.boundingBox;
    const idHeight = 12;
    const gap = 0;

    // Get page dimensions to clamp position
    const pageInfo = await instance.pageInfoForIndex(widget.pageIndex);
    const maxTop = pageInfo.height - idHeight;
    const top = Math.min(bbox.top + bbox.height + gap, maxTop);

    const textAnnotation = new PSPDFKit.Annotations.TextAnnotation({
      pageIndex: widget.pageIndex,
      boundingBox: new PSPDFKit.Geometry.Rect({
        left: bbox.left,
        top,
        width: bbox.width,
        height: idHeight,
      }),
      text: { format: 'plain', value: displayId },
      font: 'Helvetica',
      fontSize: 8,
      fontColor: new PSPDFKit.Color({ r: 153, g: 153, b: 153 }),
      horizontalAlign: 'left',
      isFitting: false,
      callout: null,
      customData: {
        signerID: recipientId,
        signatureRequestId: signingRequestId,
        purpose: 'signer-audit-id',
      },
    });

    await instance.create(textAnnotation);
  }
};

export default function SignDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingData, setSigningData] = useState<SigningData | null>(null);
  const [isViewerLoaded, setIsViewerLoaded] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [finalizationPending, setFinalizationPending] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [allFieldsFilled, setAllFieldsFilled] = useState(false);

  const [isSdkReady, setIsSdkReady] = useState(() => typeof window !== 'undefined' && !!window.NutrientViewer);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const viewerInstanceRef = useRef<any>(null); // PSPDFKit viewer instance type not available
  const isLoadingRef = useRef(false);

  // If the SDK wasn't ready at mount (e.g. slow network), poll briefly
  useEffect(() => {
    if (isSdkReady) return;
    const id = setInterval(() => {
      if (typeof window !== 'undefined' && window.NutrientViewer) {
        setIsSdkReady(true);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [isSdkReady]);

  // Verify token and load document data
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const verifyToken = async () => {
      try {
        setIsVerifying(true);
        const response = await fetch('/api/sign/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          signal: abortController.signal,
        });

        if (!isMounted) return;

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Invalid or expired link');
        }

        const data = await response.json();

        if (!isMounted) return;

        setSigningData(data);
        postSigningEmbedEvent('ready', data.document.id, {
          recipientId: data.recipient.id,
          signatureRequestId: data.signatureRequest.id,
        });

        // Check if already signed
        if (data.signatureRequest.status === 'SIGNED') {
          setIsSigned(true);
          setError('This document has already been signed.');
          postSigningEmbedEvent('completed', data.document.id, { alreadySigned: true });
        }

        // Check if cancelled
        if (data.signatureRequest.status === 'CANCELLED') {
          setError('This document has been cancelled by the sender.');
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Error verifying token:', err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to load document';
          setError(message);
          postSigningEmbedEvent('error', undefined, { message, stage: 'verification' });
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    };

    if (token) {
      verifyToken();
    }

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [token]);

  // Load document in Nutrient Viewer
  // Uses containerEl state (set via callback ref) to ensure DOM is ready
  // biome-ignore lint/correctness/useExhaustiveDependencies: isViewerLoaded intentionally excluded to prevent cleanup loop that unloads viewer
  useEffect(() => {
    if (!signingData || !containerEl || !isSdkReady || isViewerLoaded || isSigned || isLoadingRef.current) {
      return;
    }

    let isMounted = true;
    isLoadingRef.current = true;

    const loadViewer = async () => {
      try {
        // Create proxy URL for the document
        const docKey = signingData.document.filePath.startsWith('http')
          ? new URL(signingData.document.filePath).pathname.substring(1)
          : signingData.document.filePath;

        const proxyUrl = `/api/documents/proxy?key=${encodeURIComponent(docKey)}&proxy=true&signingToken=${encodeURIComponent(token)}`;

        const PSPDFKit = getNutrientViewerRuntime();
        if (!PSPDFKit) {
          throw new Error('Nutrient Viewer SDK not loaded');
        }

        // Only load if component is still mounted
        if (!isMounted || !containerEl) {
          return;
        }

        // Load InstantJSON if available (new approach)
        const instantJSON = signingData.annotations;

        // Load viewer with signing tools enabled and custom field renderer
        const instance = await safeLoadViewer({
          container: containerEl,
          document: proxyUrl,
          licenseKey: process.env.NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY,
          useCDN: true,
          instantJSON: instantJSON, // Load annotations automatically from InstantJSON
          toolbarItems: [
            { type: 'sidebar-thumbnails' },
            { type: 'pager' },
            { type: 'zoom-out' },
            { type: 'zoom-in' },
            { type: 'spacer' },
          ],
          styleSheets: ['/styles/viewer.css'],
          customRenderers: {
            Annotation: createSignatureFieldRenderer({
              currentRecipientId: signingData.recipient.id,
              participants: signingData.participants,
            }),
          },
        });

        if (!isMounted) {
          return;
        }

        viewerInstanceRef.current = instance;

        // Fields are now loaded automatically from InstantJSON!
        // No manual field creation needed

        // Setup signature storage
        setupSignatureStorage(instance, PSPDFKit, signingData.document.id, signingData.recipient.id);

        if (isMounted) {
          setIsViewerLoaded(true);
          isLoadingRef.current = false;
          postSigningEmbedEvent('viewer-ready', signingData.document.id, {
            recipientId: signingData.recipient.id,
          });
        }
      } catch (err) {
        console.error('Error loading viewer:', err);
        if (isMounted) {
          setError('Failed to load document viewer');
          isLoadingRef.current = false;
          postSigningEmbedEvent('error', signingData.document.id, {
            message: 'Failed to load document viewer',
            stage: 'viewer',
          });
        }
      }
    };

    loadViewer();

    return () => {
      isMounted = false;
      isLoadingRef.current = false;
      // Always try to unload viewer on cleanup
      if (containerEl) {
        safeUnloadViewer(containerEl);
        viewerInstanceRef.current = null;
      }
    };
  }, [signingData, isSigned, isSdkReady, containerEl, token]);

  // Update form field permissions based on current recipient
  // This runs after fields are created to set proper readOnly status
  useEffect(() => {
    const instance = viewerInstanceRef.current;
    const PSPDFKit = getNutrientViewerRuntime();
    if (!instance || !PSPDFKit || !isViewerLoaded || !signingData) return;

    const updateFieldPermissions = async () => {
      try {
        const formFields = await instance.getFormFields();
        if (formFields.size === 0) {
          return;
        }

        // Get all annotations from all pages to find widget customData
        const totalPages = await instance.totalPageCount;
        let allAnnotations: any[] = [];
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          const pageAnnotations = await instance.getAnnotations(pageIndex);
          allAnnotations = allAnnotations.concat(pageAnnotations.toArray());
        }

        for (const field of formFields) {
          // Find the widget annotation associated with this form field
          const widget = allAnnotations.find((ann) => ann.formFieldName === field.name);

          if (widget?.customData) {
            const signerID = widget.customData.signerID;

            // Determine if current recipient can edit this field
            // Primary: Use signerID (participant ID) which is the most reliable
            // The signerID is set when fields are placed and should match the participant ID
            const isUserField = signerID && signerID !== '' && signerID === signingData.recipient.id;

            const currentReadOnly = field.readOnly || false;
            const newReadOnly = !isUserField;

            // Only update if the value needs to change
            if (currentReadOnly !== newReadOnly) {
              const updatedField = field.set('readOnly', newReadOnly);
              await instance.update(updatedField);
            }

            // Seed identity/date fields from the verified recipient record. The
            // values remain editable, matching the behavior of Michael's POC.
            if (isUserField) {
              let prefillValue: string | undefined;
              if (field.name.startsWith('name_')) {
                prefillValue = signingData.recipient.name;
              } else if (field.name.startsWith('email_')) {
                prefillValue = signingData.recipient.email;
              } else if (field.name.startsWith('date_')) {
                const today = new Date();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                prefillValue = `${month}/${day}/${today.getFullYear()}`;
              }

              if (prefillValue !== undefined) {
                await instance.setFormFieldValues({ [field.name]: prefillValue });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error updating field permissions:', error);
      }
    };

    // Small delay to ensure annotations are fully created
    const timeoutId = setTimeout(() => {
      updateFieldPermissions();
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [signingData, isViewerLoaded]);

  // Check if all current recipient's fields are filled
  useEffect(() => {
    const instance = viewerInstanceRef.current;
    const PSPDFKit = getNutrientViewerRuntime();
    if (!instance || !PSPDFKit || !isViewerLoaded || !signingData) return;

    const checkFieldCompletion = async () => {
      try {
        const formFields = await instance.getFormFields();
        if (formFields.size === 0) {
          setAllFieldsFilled(false);
          return;
        }

        // Get all annotations to access customData with signerID
        const totalPages = await instance.totalPageCount;
        let allAnnotations: any[] = [];
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          const pageAnnotations = await instance.getAnnotations(pageIndex);
          allAnnotations = allAnnotations.concat(pageAnnotations.toArray());
        }

        // Filter fields that belong to current recipient using signerID from customData
        const myFields = [];
        for (const field of formFields.toArray()) {
          const widget = allAnnotations.find((ann) => ann.formFieldName === field.name);
          const signerID = widget?.customData?.signerID;
          if (signerID && signerID === signingData.recipient.id) {
            myFields.push(field);
          }
        }

        if (myFields.length === 0) {
          setAllFieldsFilled(false);
          return;
        }

        // Get form field values
        const formFieldValues = await instance.getFormFieldValues();

        // Check each field
        let allFilled = true;
        for (const field of myFields) {
          const isSignatureField = field instanceof PSPDFKit.FormFields.SignatureFormField;

          if (isSignatureField) {
            // Check if signature field has overlapping annotations (is signed)
            const overlapping = await instance.getOverlappingAnnotations(field);
            if (overlapping.size === 0) {
              allFilled = false;
              break;
            }
          } else {
            // Text, identity, date, and checkbox fields all carry values.
            const value = formFieldValues[field.name] ?? field.value;
            if (!hasRequiredFieldValue(value)) {
              allFilled = false;
              break;
            }
          }
        }

        setAllFieldsFilled(allFilled);
      } catch (err) {
        console.error('Error checking field completion:', err);
        setAllFieldsFilled(false);
      }
    };

    // Check immediately
    checkFieldCompletion();

    // Listen for form field value changes and annotation changes
    const handleFormFieldUpdate = () => checkFieldCompletion();
    const handleAnnotationCreate = () => checkFieldCompletion();
    const handleAnnotationUpdate = () => checkFieldCompletion();
    const handleAnnotationDelete = () => checkFieldCompletion();
    const handleAnnotationChange = () => checkFieldCompletion();

    // Listen for annotation press which happens when clicking to apply stored signature
    const handleAnnotationPress = () => {
      // Small delay to allow annotation to be fully applied
      setTimeout(checkFieldCompletion, 100);
    };

    instance.addEventListener('formFields.update', handleFormFieldUpdate);
    instance.addEventListener('annotations.create', handleAnnotationCreate);
    instance.addEventListener('annotations.update', handleAnnotationUpdate);
    instance.addEventListener('annotations.delete', handleAnnotationDelete);
    instance.addEventListener('annotations.change', handleAnnotationChange);
    instance.addEventListener('annotations.press', handleAnnotationPress);

    return () => {
      instance.removeEventListener('formFields.update', handleFormFieldUpdate);
      instance.removeEventListener('annotations.create', handleAnnotationCreate);
      instance.removeEventListener('annotations.update', handleAnnotationUpdate);
      instance.removeEventListener('annotations.delete', handleAnnotationDelete);
      instance.removeEventListener('annotations.change', handleAnnotationChange);
      instance.removeEventListener('annotations.press', handleAnnotationPress);
    };
  }, [signingData, isViewerLoaded]);

  // Handle signature submission
  const handleSign = useCallback(async () => {
    if (!signingData || !viewerInstanceRef.current) return;

    try {
      setIsSigning(true);
      postSigningEmbedEvent('submitting', signingData.document.id, {
        signatureRequestId: signingData.signatureRequest.id,
      });

      // Add signer ID text below each signature field BEFORE exporting InstantJSON
      // so the ID annotations are persisted for subsequent signers to see
      const PSPDFKit = getNutrientViewerRuntime();
      if (PSPDFKit) {
        await addSignerIdAnnotations(
          viewerInstanceRef.current,
          PSPDFKit,
          signingData.recipient.id,
          signingData.signatureRequest.id,
        );
      }

      // Export the current InstantJSON with all signatures (including signer ID annotations)
      const exportedJSON = await viewerInstanceRef.current.exportInstantJSON();

      // Clean the InstantJSON by removing form field styling (backgroundColor, borderColor, borderWidth)
      // This prevents colored backgrounds and borders from showing in finalized documents
      const cleanedJSON = { ...exportedJSON };
      if (cleanedJSON.annotations) {
        cleanedJSON.annotations = cleanedJSON.annotations.map((ann: Record<string, unknown>) => {
          if (ann.type === 'pspdfkit/widget' || ann.formFieldName) {
            const { backgroundColor, borderColor, borderWidth, fillColor, strokeColor, ...rest } = ann;
            return rest;
          }
          return ann;
        });
      }
      if (cleanedJSON.formFields) {
        cleanedJSON.formFields = cleanedJSON.formFields.map((field: Record<string, unknown>) => {
          const { backgroundColor, borderColor, borderWidth, fillColor, strokeColor, ...rest } = field;
          return rest;
        });
      }

      const response = await fetch('/api/sign/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureRequestId: signingData.signatureRequest.id,
          instantJSON: cleanedJSON,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit signature');
      }

      const result = await response.json();

      toast({
        title: 'Signature recorded',
        description: result.finalizationPending
          ? 'Your signature is saved, but the final PDF is not ready. The document owner must complete finalization.'
          : result.allSigned
            ? 'All signatures are complete and the final PDF is ready.'
            : 'Your signature has been recorded.',
      });

      setIsSigned(true);
      setFinalizationPending(Boolean(result.finalizationPending));
      postSigningEmbedEvent('completed', signingData.document.id, {
        allSigned: Boolean(result.allSigned),
        finalizationPending: Boolean(result.finalizationPending),
      });

      // Redirect to success page after 2 seconds
      setTimeout(() => {
        if (!isEmbeddedWindow() && !result.finalizationPending) router.push(`/sign/${token}/success`);
      }, 2000);
    } catch (err) {
      console.error('Error signing document:', err);
      postSigningEmbedEvent('error', signingData.document.id, {
        message: err instanceof Error ? err.message : 'Failed to submit signature',
        stage: 'submission',
      });
      toast({
        title: 'Signature Failed',
        description: err instanceof Error ? err.message : 'Failed to submit signature',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  }, [signingData, token, router]);

  // Handle declining to sign
  const handleDecline = useCallback(async () => {
    if (!signingData) return;
    setShowDeclineDialog(false);

    try {
      setIsSigning(true);

      const response = await fetch('/api/sign/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureRequestId: signingData.signatureRequest.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to decline signature');
      }

      toast({
        title: 'Signature Declined',
        description: 'Your decline has been recorded and signing has stopped for this document.',
      });

      setIsDeclined(true);
      postSigningEmbedEvent('declined', signingData.document.id, {
        signatureRequestId: signingData.signatureRequest.id,
      });

      // Redirect after brief delay
      setTimeout(() => {
        if (!isEmbeddedWindow()) router.push('/inbox');
      }, 2000);
    } catch (err) {
      console.error('Error declining signature:', err);
      postSigningEmbedEvent('error', signingData.document.id, {
        message: err instanceof Error ? err.message : 'Failed to decline signature',
        stage: 'decline',
      });
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to decline signature',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  }, [signingData, token, router]);

  // Loading state
  if (isVerifying) {
    return (
      <div
        className="empty"
        style={{
          padding: 'var(--space-9) 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <Loader2
          aria-hidden="true"
          className="animate-spin"
          style={{ width: 36, height: 36, color: 'var(--brand-accent)' }}
        />
        <p style={{ color: 'var(--ink-3)', margin: 0 }}>Verifying access…</p>
      </div>
    );
  }

  // Error state
  if (error && !isSigned) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: 'var(--space-7) auto',
          padding: 'var(--space-7)',
          textAlign: 'center',
          border: '1px solid color-mix(in srgb, rgb(180, 60, 60) 30%, var(--line))',
          borderRadius: 'var(--r-2)',
          background: 'var(--bg-elev)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'color-mix(in srgb, rgb(180, 60, 60) 12%, transparent)',
            color: 'rgb(180, 60, 60)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-4)',
          }}
        >
          <ShieldAlert width={32} height={32} />
        </div>
        <h2 style={{ color: 'var(--ink)', fontSize: 'var(--text-xl)', fontWeight: 600, margin: 0 }}>Access Denied</h2>
        <p style={{ color: 'var(--ink-3)', marginTop: 'var(--space-3)' }}>{error}</p>
      </div>
    );
  }

  // Already signed state
  if (isSigned && signingData) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: 'var(--space-7) auto',
          padding: 'var(--space-7)',
          textAlign: 'center',
          border: '1px solid color-mix(in srgb, rgb(40, 130, 80) 30%, var(--line))',
          borderRadius: 'var(--r-2)',
          background: 'var(--bg-elev)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'color-mix(in srgb, rgb(40, 130, 80) 12%, transparent)',
            color: 'rgb(40, 130, 80)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-4)',
          }}
        >
          <CheckCircle width={32} height={32} />
        </div>
        <h2 style={{ color: 'var(--ink)', fontSize: 'var(--text-xl)', fontWeight: 600, margin: 0 }}>
          Signature recorded
        </h2>
        <p style={{ color: 'var(--ink-3)', marginTop: 'var(--space-3)' }}>
          You have successfully signed &ldquo;{signingData.document.name}&rdquo;
        </p>
        <p style={{ color: 'var(--ink-4)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-4)' }}>
          {finalizationPending
            ? 'The final PDF is not ready. The document owner must complete finalization; your signature is already saved.'
            : 'Thank you for completing this signature request.'}
        </p>
      </div>
    );
  }

  // Main signing interface
  return (
    <>
      {/* Page head with title + actions */}
      {signingData?.finalizationAvailable === false && (
        <p role="status" className="rounded border p-3 text-sm">
          PDF finalization is not configured for this evaluation. You can record a test signature, but a completed
          electronic PDF will not be produced until the document owner enables finalization.
        </p>
      )}
      <div className="app-page-head" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="app-h1">{signingData?.document.name || 'Sign Document'}</h1>
          {signingData && (
            <p>
              Sent by {signingData.sender?.name || 'Document sender'}
              {signingData.document.expiresAt &&
                ` • Expires ${new Date(signingData.document.expiresAt).toLocaleDateString()}`}
            </p>
          )}
        </div>
        {signingData && !isSigned && !isDeclined && (
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn ghost sm danger"
              onClick={() => setShowDeclineDialog(true)}
              disabled={isSigning}
            >
              Decline to sign
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleSign}
              disabled={isSigning || !allFieldsFilled}
              style={{ opacity: !allFieldsFilled && !isSigning ? 0.5 : undefined }}
              aria-busy={isSigning}
            >
              {isSigning ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin"
                    style={{ width: 16, height: 16, marginRight: 6 }}
                  />
                  Signing…
                </>
              ) : (
                'Sign Document'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Required-fields warning */}
      {signingData && !isSigned && !isDeclined && !allFieldsFilled && !isSigning && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Alert variant="warn">Please fill all required fields to enable signing.</Alert>
        </div>
      )}

      {/* Document viewer (real PSPDFKit) */}
      <ViewerErrorBoundary>
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            position: 'relative',
            height: 'calc(100vh - 320px)',
            minHeight: 500,
          }}
        >
          {isViewerLoaded && signingData && !isSigned && !isDeclined && (
            <SignHereWidget
              instance={viewerInstanceRef.current}
              recipientId={signingData.recipient.id}
              isViewerLoaded={isViewerLoaded}
              containerEl={containerEl}
              allFieldsFilled={allFieldsFilled}
            />
          )}
          <div ref={setContainerEl} style={{ height: '100%', width: '100%' }} id="nutrient-signing-container" />
        </div>
      </ViewerErrorBoundary>

      {/* Footer info row */}
      {signingData && !isSigned && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-4)',
            background: 'var(--surface)',
            borderRadius: 'var(--r-2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--text-sm)',
            color: 'var(--ink-3)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <span>
            Signing as: <strong style={{ color: 'var(--ink)' }}>{signingData.recipient.name}</strong>{' '}
            <span className="muted">({signingData.recipient.email})</span>
          </span>
          {signingData.participants.length > 1 && (
            <span className="muted">{signingData.participants.length} total signers</span>
          )}
        </div>
      )}

      {/* Decline confirmation dialog */}
      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline to Sign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline signing this document? Your decision will be recorded and signing will
              stop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleDecline}>
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
