'use client';

import { useSession } from 'next-auth/react';
import type React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/sign-design/alert';
import { IconDate, IconInitials, IconSignature } from '@/components/sign-design/icons';
import { toast } from '@/components/ui/use-toast';
import { findFieldPosition } from '@/lib/field-auto-placement';
import { closestByClass, getNutrientViewerRuntime, safeLoadViewer, safeUnloadViewer } from '@/lib/nutrient-viewer';
import { useDocumentFlow } from '../../context/DocumentFlowContext';
import { FormPlacementContext, FormPlacementProvider } from '../../context/FormPlacementContext';
import { useViewerInstance } from '../../context/ViewerInstanceContext';
import RecipientDropdown from './RecipientDropdown';

// Import the custom CSS for field styling
import '@/public/styles/custom-fields.css';

import { FieldList } from './field-placement/FieldList';
import { FieldOption } from './field-placement/FieldOption';
import { FIELD_SPECS, getFieldSpec, isPlaceableFieldType } from './field-placement/field-specs';
import type {
  DocumentFlowState,
  FieldPlacement as FieldPlacementType,
  NutrientViewerInstance,
} from './field-placement/types';
import { attachDragDropListeners } from './field-placement/use-drag-drop';
import { attachTouchListeners } from './field-placement/use-touch-handling';
import { useViewerSetup } from './field-placement/use-viewer-setup';
import {
  buildFormField,
  buildWidgetConfig,
  createFieldName,
  getAnnotationRenderers,
  getInitials,
  setFormCreatorMode,
} from './field-placement/utils';

export default function FieldPlacement() {
  const documentFlowState = useDocumentFlow();
  const { state, dispatch } = documentFlowState || {
    state: { document: { url: undefined } } as DocumentFlowState,
    dispatch: () => {},
  };

  const { data: session } = useSession();
  const [localFormPlacementMode, setLocalFormPlacementMode] = useState(false);

  // Ref for the field creation callback — set by FieldPlacementContent once viewer is ready
  const createFieldRef = useRef<((fieldType: string) => void) | undefined>(undefined);
  const handleCreateField = useCallback((fieldType: string) => {
    createFieldRef.current?.(fieldType);
  }, []);

  const recipients = state.recipients || [];

  return (
    <FormPlacementProvider
      recipients={recipients}
      userWillSign={state.userWillSign}
      userDisplayName={state.userDisplayName ?? undefined}
      userEmail={session?.user?.email ?? undefined}
      ownerParticipantId={state.ownerParticipantId}
      onCreateField={handleCreateField}
    >
      <FieldPlacementContent
        localMode={localFormPlacementMode}
        setLocalMode={setLocalFormPlacementMode}
        documentState={state}
        documentDispatch={dispatch}
        createFieldRef={createFieldRef}
      />
    </FormPlacementProvider>
  );
}

// Separate content component that uses the FormPlacementContext
function FieldPlacementContent({
  localMode,
  setLocalMode,
  documentState,
  documentDispatch,
  createFieldRef,
}: {
  localMode: boolean;
  setLocalMode: React.Dispatch<React.SetStateAction<boolean>>;
  documentState: any;
  documentDispatch: any;
  createFieldRef: React.MutableRefObject<((fieldType: string) => void) | undefined>;
}) {
  const {
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
  } = useViewerSetup({
    documentUrl: documentState?.document?.url,
    documentId: documentState?.document?.id,
    templateId: documentState?.document?.templateId,
  });
  const { viewerInstanceRef } = useViewerInstance();

  const {
    setFormPlacementMode,
    currentRecipient,
    currentRecipientIndex,
    signerRecipients,
    recipientColors,
    updateFieldCount,
    allSignersHaveSignatures,
    signersWithoutSignatures,
  } = useContext(FormPlacementContext);

  // Store current recipient index in a ref so event handlers always get latest value
  const currentRecipientIndexRef = useRef(currentRecipientIndex);
  const signerRecipientsRef = useRef(signerRecipients);

  useEffect(() => {
    currentRecipientIndexRef.current = currentRecipientIndex;
    signerRecipientsRef.current = signerRecipients;
  }, [currentRecipientIndex, signerRecipients]);

  // Always in edit mode
  useEffect(() => {
    setFormPlacementMode(true);
    setLocalMode(true);
  }, [setFormPlacementMode, setLocalMode]);

  const [fieldPlacements, setFieldPlacements] = useState<FieldPlacementType[]>([]);

  const reconcileFieldPlacements = useCallback(
    async (instance: NutrientViewerInstance) => {
      const formFields = await instance.getFormFields();
      const nextPlacements: FieldPlacementType[] = [];

      for (let pageIndex = 0; pageIndex < instance.totalPageCount; pageIndex++) {
        const annotations = await instance.getAnnotations(pageIndex);
        for (const annotation of annotations.toArray()) {
          const widget = annotation as any;
          const fieldName = widget.formFieldName;
          if (!fieldName || !formFields.find((field: any) => field.name === fieldName)) continue;

          const rawType = widget.customData?.type || fieldName.split('_')[0];
          const fieldType = rawType === 'initial' ? 'initials' : rawType;
          if (!isPlaceableFieldType(fieldType)) continue;

          const boundingBox = widget.boundingBox;
          nextPlacements.push({
            type: fieldType,
            position: `(${Math.round(boundingBox.left)}, ${Math.round(boundingBox.top)})`,
            name: fieldName,
            recipient: widget.customData?.recipientEmail || widget.customData?.signerEmail,
            pageIndex,
            coordinates: { x: Math.round(boundingBox.left), y: Math.round(boundingBox.top) },
            id: widget.id,
            width: Math.round(boundingBox.width),
            height: Math.round(boundingBox.height),
          });
        }
      }

      nextPlacements.sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0) || a.name.localeCompare(b.name));

      setFieldPlacements((previous) => {
        const previousByName = new Map(previous.map((field) => [field.name, field]));
        const nextByName = new Map(nextPlacements.map((field) => [field.name, field]));

        for (const field of previous) {
          if (!nextByName.has(field.name) && field.recipient) {
            updateFieldCount(field.recipient, field.type, false);
          }
        }
        for (const field of nextPlacements) {
          if (!previousByName.has(field.name) && field.recipient) {
            updateFieldCount(field.recipient, field.type, true);
          }
        }

        return nextPlacements;
      });
    },
    [updateFieldCount],
  );

  // Provide the direct field creation callback for touch/click on tablet/mobile.
  const creationQueue = useRef<Promise<void>>(Promise.resolve());
  // Uses refs so the closure always has latest state without re-registering.
  useEffect(() => {
    createFieldRef.current = (fieldType: string) => {
      const instance = viewerInstanceRef.current;
      const runtime = getNutrientViewerRuntime();
      if (!instance || !runtime) return;

      const recipient = signerRecipientsRef.current[currentRecipientIndexRef.current];
      if (!recipient) return;
      const pageIndex = instance.viewState.currentPageIndex ?? 0;
      const fieldName = createFieldName(fieldType, recipient);

      const fieldSpec = getFieldSpec(fieldType);
      if (!fieldSpec) return;
      const pdfWidth = fieldSpec.width;
      const pdfHeight = fieldSpec.height;
      creationQueue.current = creationQueue.current
        .then(async () => {
          if (viewerInstanceRef.current !== instance) return;
          const pageInfo = instance.pageInfoForIndex(pageIndex);
          if (!pageInfo) return;
          const annotations = await instance.getAnnotations(pageIndex);
          const position = findFieldPosition(
            pageInfo,
            { width: pdfWidth, height: pdfHeight },
            annotations
              .toArray()
              .map(
                (annotation: { boundingBox: { left: number; top: number; width: number; height: number } }) =>
                  annotation.boundingBox,
              ),
          );
          if (!position) {
            toast({
              title: 'No room on this page',
              description: 'Choose another page or move existing fields before adding this field.',
            });
            return;
          }
          if (viewerInstanceRef.current !== instance) return;
          const pdfRect = new runtime.Geometry.Rect(position);

          const widgetConfig = buildWidgetConfig(runtime, {
            boundingBox: pdfRect,
            fieldName,
            pageIndex,
            fieldType,
            recipient,
          });
          const widget = new runtime.Annotations.WidgetAnnotation(widgetConfig);
          const formField = buildFormField(runtime, fieldType, widget.id, fieldName, recipient);
          setFormCreatorMode(instance, runtime);

          if (formField) {
            await instance.create([widget, formField]);
            if (viewerInstanceRef.current !== instance) return;
            setFieldPlacements((prev) => [
              ...prev,
              {
                type: fieldType,
                position: `Page ${pageIndex + 1}`,
                coordinates: { x: position.left, y: position.top },
                width: pdfWidth,
                height: pdfHeight,
                id: widget.id,
                name: fieldName,
                recipient: recipient?.email,
                pageIndex,
              },
            ]);
            if (recipient?.email) {
              updateFieldCount(recipient.email, fieldType, true);
            }
          }
        })
        .catch((err: unknown) => {
          console.error('Error creating field:', err);
          toast({ title: 'Could not add field', description: 'Please try again.', variant: 'destructive' });
        });
    };
    return () => {
      createFieldRef.current = undefined;
    };
  }, [createFieldRef, viewerInstanceRef, updateFieldCount]);

  // Sync fieldPlacements to DocumentFlowContext
  useEffect(() => {
    if (!documentDispatch || !mounted) return;

    const contextFields = fieldPlacements.map((field) => {
      const recipient = signerRecipientsRef.current.find((r) => r.email === field.recipient);
      const normalizedType = field.type === 'initials' ? 'initial' : field.type;

      return {
        id: field.id || field.name,
        type: normalizedType as 'signature' | 'initial' | 'name' | 'email' | 'date' | 'text' | 'checkbox' | 'dropdown',
        recipientId: recipient?.id || '',
        position: {
          x: field.coordinates?.x || 0,
          y: field.coordinates?.y || 0,
          page: field.pageIndex || 0,
        },
        size: {
          width: field.width || 200,
          height: field.height || 50,
        },
        required: true,
        label: field.name,
      };
    });

    documentDispatch({
      type: 'SET_FIELDS',
      payload: contextFields,
    });
  }, [fieldPlacements, documentDispatch, mounted]);

  // Recreate form fields from duplicate document annotations
  const recreateFieldsFromDuplicate = async (instance: any, annotations: any) => {
    const nutrientRuntime = getNutrientViewerRuntime();
    if (!nutrientRuntime || !annotations) return;

    const formFields = annotations.formFields || [];
    const widgetAnnotations = annotations.annotations || [];

    if (formFields.length === 0) return;

    const widgetMap = new Map<string, any>();
    for (const ann of widgetAnnotations) {
      if (ann.type === 'pspdfkit/widget') {
        widgetMap.set(ann.id, ann);
      }
    }

    const currentRecipients = signerRecipientsRef.current;
    setFormCreatorMode(instance, nutrientRuntime);

    for (const field of formFields) {
      try {
        const annotationId = field.annotationIds?.[0];
        const widgetData = annotationId ? widgetMap.get(annotationId) : null;

        if (!widgetData?.bbox) continue;

        let fieldType = field.name?.split('_')[0] || 'signature';
        if (field.name?.startsWith('initials') || field.type === 'INITIALS') {
          fieldType = 'initials';
        }
        if (!isPlaceableFieldType(fieldType)) continue;

        const nameParts = field.name?.split('_') || [];
        let matchedRecipient: any = currentRecipients[0];

        if (nameParts.length >= 2) {
          const emailPrefix = nameParts[1];
          const found = currentRecipients.find((r: any) => {
            const recipientPrefix = r.email
              .split('@')[0]
              .replace(/\./g, '_')
              .replace(/[^a-zA-Z0-9_]/g, '');
            return recipientPrefix === emailPrefix;
          });
          if (found) matchedRecipient = found;
        }

        if (widgetData.customData?.recipientEmail || widgetData.customData?.signerEmail) {
          const originalEmail = widgetData.customData.recipientEmail || widgetData.customData.signerEmail;
          const found = currentRecipients.find((r: any) => r.email === originalEmail);
          if (found) matchedRecipient = found;
        }

        if (!matchedRecipient) continue;

        const newFieldName = createFieldName(fieldType, matchedRecipient);
        const pageIndex = widgetData.pageIndex ?? 0;
        const bbox = widgetData.bbox;
        const boundingBox = new nutrientRuntime.Geometry.Rect({
          left: bbox[0],
          top: bbox[1],
          width: bbox[2],
          height: bbox[3],
        });

        const widgetConfig = buildWidgetConfig(nutrientRuntime, {
          boundingBox,
          fieldName: newFieldName,
          pageIndex,
          fieldType,
          recipient: matchedRecipient,
        });
        const widget = new nutrientRuntime.Annotations.WidgetAnnotation(widgetConfig);
        const formField = buildFormField(nutrientRuntime, fieldType, widget.id, newFieldName, matchedRecipient);

        if (formField) {
          await instance.create([widget, formField]);

          setFieldPlacements((prev) => [
            ...prev,
            {
              type: fieldType,
              position: `(${Math.round(boundingBox.left)}, ${Math.round(boundingBox.top)})`,
              name: newFieldName,
              recipient: matchedRecipient.email,
              pageIndex,
              coordinates: {
                x: Math.round(boundingBox.left),
                y: Math.round(boundingBox.top),
              },
              id: widget.id,
              width: Math.round(boundingBox.width),
              height: Math.round(boundingBox.height),
            },
          ]);

          if (matchedRecipient.email) {
            updateFieldCount(matchedRecipient.email, fieldType, true);
          }
        }
      } catch (error) {
        console.error('[FieldPlacement] Error recreating field:', error);
      }
    }
  };

  // Load the Nutrient Viewer SDK with the document
  // biome-ignore lint/correctness/useExhaustiveDependencies: Viewer initialization is intentionally gated to avoid duplicate SDK instances.
  useEffect(() => {
    // Wait for mount, proxy URL, and isMobile hydration before loading.
    // Without isMobileSettled, on phones the viewer loads into the desktop
    // container (isMobile=false initially), then isMobile flips to true and
    // the desktop container unmounts, corrupting the SDK state.
    if (!mounted || !proxyUrl || !isMobileSettled) return;
    if (isViewerLoaded) return;
    if (isLoadingViewerRef.current) return;

    let cancelled = false;
    setError(null);

    const container = isMobile ? mobileContainerRef.current : desktopContainerRef.current;

    if (container && typeof window !== 'undefined' && window.NutrientViewer) {
      setIsLoading(true);

      const toolBarItems = isMobile
        ? [
            { type: 'pager' },
            { type: 'pan' },
            { type: 'zoom-out' },
            { type: 'zoom-in' },
            { type: 'undo' },
            { type: 'redo' },
            { type: 'spacer' },
          ]
        : [
            { type: 'sidebar-thumbnails' },
            { type: 'sidebar-document-outline' },
            { type: 'pager' },
            { type: 'pan' },
            { type: 'zoom-out' },
            { type: 'zoom-in' },
            { type: 'zoom-mode' },
            { type: 'undo' },
            { type: 'redo' },
            { type: 'spacer' },
          ];

      try {
        // Unload any lingering SDK instance from BOTH containers
        if (desktopContainerRef.current) {
          safeUnloadViewer(desktopContainerRef.current);
        }
        if (mobileContainerRef.current) {
          safeUnloadViewer(mobileContainerRef.current);
        }

        // Ensure container is completely empty before loading
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        isLoadingViewerRef.current = true;

        safeLoadViewer({
          container,
          document: proxyUrl,
          toolbarItems: toolBarItems,
          enableHistory: true,
          licenseKey: process.env.NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY,
          useCDN: true,
          styleSheets: ['/styles/viewer.css'],
          customRenderers: {
            Annotation: getAnnotationRenderers(
              getNutrientViewerRuntime(),
              currentRecipient,
              recipientColors,
              signerRecipients,
            ),
          },
        })
          .then((instance: NutrientViewerInstance) => {
            viewerInstanceRef.current = instance;

            attachDragDropListeners(instance, {
              signerRecipientsRef,
              currentRecipientIndexRef,
              setFieldPlacements,
              updateFieldCount,
            });

            setIsViewerLoaded(true);
            setIsLoading(false);

            if (documentState.duplicateAnnotations) {
              recreateFieldsFromDuplicate(instance, documentState.duplicateAnnotations);
            }

            const handleHistoryChange = () => {
              void reconcileFieldPlacements(instance).catch((historyError) => {
                console.error('Failed to reconcile fields after undo/redo:', historyError);
              });
            };
            instance.addEventListener('history.undo', handleHistoryChange);
            instance.addEventListener('history.redo', handleHistoryChange);

            // Highlight field in list when clicking annotation in viewer
            instance.contentDocument.addEventListener('click', (event: Event) => {
              const target = event.target as Element;
              const annotationWidget = closestByClass(target, 'PSPDFKit-Annotation-Widget');
              if (annotationWidget) {
                const fieldName = annotationWidget.getAttribute('name');
                if (fieldName) {
                  const fieldIndex = fieldPlacements.findIndex((field) => field.name === fieldName);
                  if (fieldIndex >= 0) {
                    const fieldElement = document.getElementById(`field-placement-${fieldIndex}`);
                    if (fieldElement) {
                      fieldElement.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
                      setTimeout(() => {
                        fieldElement.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
                      }, 1500);
                      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                  }
                }
              }
            });

            // Attach touch listeners for touch-capable devices (mobile + tablet)
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (isMobile || isTouchDevice) {
              const cleanup = attachTouchListeners(instance, {
                currentRecipient,
                setFieldPlacements,
                updateFieldCount,
              });
              windowListenerCleanupRef.current = cleanup;
            }

            // Track annotation deletions to update field counts
            instance.addEventListener('annotations.delete', (deletedAnnotations: any) => {
              const annotationsArray = deletedAnnotations.toArray ? deletedAnnotations.toArray() : [deletedAnnotations];

              annotationsArray.forEach((annotation: any) => {
                const fieldName = annotation.name;
                if (!fieldName) return;

                const fieldType = fieldName.split('_')[0];
                if (!isPlaceableFieldType(fieldType)) return;

                let recipientEmail = null;

                const fieldPlacement = fieldPlacements.find((f) => f.name === fieldName);
                if (fieldPlacement?.recipient) {
                  recipientEmail = fieldPlacement.recipient;
                } else {
                  const nameParts = fieldName.split('_');
                  if (nameParts.length >= 2) {
                    const identifier = nameParts[1];
                    const matchingRecipient = signerRecipients.find(
                      (r) => r.email.includes(identifier) || r.email.split('@')[0] === identifier,
                    );
                    if (matchingRecipient) {
                      recipientEmail = matchingRecipient.email;
                    }
                  }
                }

                if (recipientEmail) {
                  updateFieldCount(recipientEmail, fieldType, false);
                  setFieldPlacements((prev) => prev.filter((field) => field.name !== fieldName));
                }
              });
            });

            isLoadingViewerRef.current = false;
          })
          .catch((error: any) => {
            if (cancelled) {
              isLoadingViewerRef.current = false;
              return;
            }
            console.error('Error loading NutrientViewer:', error);
            if (!error?.message?.includes('already used')) {
              setError('Failed to load document viewer');
            }
            setIsLoading(false);
            isLoadingViewerRef.current = false;
          });
      } catch (error) {
        console.error('Error loading document viewer:', error);
        if (!cancelled) {
          setError('Failed to load document viewer');
        }
        setIsLoading(false);
        isLoadingViewerRef.current = false;
      }
    } else if (!container) {
      // Container not ready — will re-run when isMobile settles
    } else {
      setError('Document viewer not available');
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      isLoadingViewerRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    proxyUrl,
    mounted,
    isMobile,
    isMobileSettled,
    currentRecipient,
    fieldPlacements.find,
    fieldPlacements.findIndex,
    isViewerLoaded,
    recipientColors,
    signerRecipients,
    updateFieldCount,
    viewerInstanceRef,
  ]);

  // Toggle form placement mode
  useEffect(() => {
    if (viewerInstanceRef.current && mounted) {
      const nutrientRuntime = getNutrientViewerRuntime();
      if (nutrientRuntime) {
        const instance = viewerInstanceRef.current;
        if (localMode) {
          instance.setViewState((viewState: any) => {
            return viewState.set('interactionMode', nutrientRuntime.InteractionMode.FORM_CREATOR);
          });
        } else {
          instance.setViewState((viewState: any) => {
            return viewState.set('interactionMode', null);
          });
        }
      }
    }
  }, [localMode, mounted, viewerInstanceRef.current]);

  // Update custom renderers when the current recipient changes
  useEffect(() => {
    if (!isViewerLoaded || !viewerInstanceRef.current) return;

    const instance = viewerInstanceRef.current;
    const runtime = getNutrientViewerRuntime();

    if (instance && runtime) {
      instance.setCustomRenderers({
        Annotation: getAnnotationRenderers(runtime, currentRecipient, recipientColors, signerRecipients),
      });
    }
  }, [isViewerLoaded, recipientColors, signerRecipients, currentRecipient, viewerInstanceRef.current]);

  // Update DocumentFlowContext validation state
  useEffect(() => {
    if (mounted && documentDispatch) {
      documentDispatch({
        type: 'VALIDATE_STEP',
        payload: {
          step: 'step3Valid',
          isValid: allSignersHaveSignatures,
        },
      });
    }
  }, [allSignersHaveSignatures, mounted, documentDispatch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Page heading */}
      <div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Field Placement</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
          Drag fields onto the document where you want recipients to sign.
        </p>
      </div>

      {/* Two-column grid: left rail + viewer */}
      <div
        className="fields-step-grid"
        style={{
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-2)',
          overflow: 'hidden',
          background: 'var(--bg-elev)',
        }}
      >
        {/* LEFT RAIL */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderRight: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {signerRecipients.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {signerRecipients.length > 1 ? 'Select signer' : 'Placing fields for'}
              </div>
              <RecipientDropdown />
            </div>
          )}

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Available fields
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FIELD_SPECS.map((spec) => {
                const icon =
                  spec.type === 'signature' ? (
                    <IconSignature aria-hidden="true" />
                  ) : spec.type === 'initials' ? (
                    <IconInitials text={getInitials(currentRecipient?.name)} />
                  ) : spec.type === 'date' ? (
                    <IconDate aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" style={{ fontSize: 11, fontWeight: 700 }}>
                      {spec.type === 'checkbox' ? '✓' : spec.type === 'email' ? '@' : spec.type === 'name' ? 'Aa' : 'T'}
                    </span>
                  );
                return <FieldOption key={spec.type} icon={icon} label={spec.label} type={spec.type} />;
              })}
            </div>
          </div>

          <FieldList
            fieldPlacements={fieldPlacements}
            setFieldPlacements={setFieldPlacements}
            signerRecipients={signerRecipients}
            recipientColors={recipientColors}
            updateFieldCount={updateFieldCount}
          />
        </div>

        {/* RIGHT — REAL VIEWER */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 560, position: 'relative' }}>
          {error && !isLoading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(180,60,60,0.05)',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  padding: 'var(--space-5)',
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-2)',
                  color: 'rgb(180, 60, 60)',
                  pointerEvents: 'auto',
                }}
              >
                {error}
              </div>
            </div>
          )}
          {isMobile ? (
            <div
              id="nutrient-viewer-container-mobile"
              ref={mobileContainerRef}
              style={{ width: '100%', height: '70vh' }}
            />
          ) : (
            <div
              id="nutrient-viewer-container"
              ref={desktopContainerRef}
              style={{ height: '100%', width: '100%', minHeight: 500 }}
            />
          )}
        </div>
      </div>

      {/* Validation alert */}
      {!allSignersHaveSignatures && signerRecipients.length > 0 && (
        <Alert variant="warn" title="Required signature fields">
          {signersWithoutSignatures.length === 1 ? (
            <>
              {signerRecipients.find((r) => r.email === signersWithoutSignatures[0])?.name || 'One recipient'} needs at
              least one signature field.
            </>
          ) : (
            <>
              {signersWithoutSignatures.length} recipients still need signature fields. Switch between recipients to add
              fields for each signer.
            </>
          )}
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {signersWithoutSignatures.map((email) => (
              <li key={email}>{signerRecipients.find((r) => r.email === email)?.name}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
