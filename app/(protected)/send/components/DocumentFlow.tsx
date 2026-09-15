'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { DocumentFlowProvider, useDocumentFlow } from '../context/DocumentFlowContext';
import { useViewerInstance } from '../context/ViewerInstanceContext';
import NavigationControls from './NavigationControls';
import StepIndicator from './StepIndicator';

// This will be a wrapper component that includes both the provider and the flow UI
export default function DocumentFlow({
  children,
  duplicateFrom,
}: {
  children: (state: any) => React.ReactNode;
  duplicateFrom?: string | null;
}) {
  return (
    <DocumentFlowProvider>
      <DocumentFlowContent duplicateFrom={duplicateFrom}>{children}</DocumentFlowContent>
    </DocumentFlowProvider>
  );
}

// Separate component to use the context inside the provider
function DocumentFlowContent({
  children,
  duplicateFrom,
}: {
  children: (state: any) => React.ReactNode;
  duplicateFrom?: string | null;
}) {
  const { state, dispatch } = useDocumentFlow();
  const { viewerInstanceRef } = useViewerInstance();
  const [isSubmitting, _setIsSubmitting] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);

  useEffect(() => {
    if (!duplicateFrom || state.document.id) return;

    const hydrate = async () => {
      setIsHydrating(true);
      try {
        const response = await fetch(`/api/documents/${duplicateFrom}/duplicate-data`);
        if (!response.ok) throw new Error('Failed to fetch duplicate data');

        const data = await response.json();

        // Determine if owner is among participants
        const ownerRecipient = data.recipients.find((r: any) => r.isOwner);
        const otherRecipients = data.recipients.filter((r: any) => !r.isOwner);

        dispatch({
          type: 'HYDRATE_FROM_DUPLICATE',
          payload: {
            document: {
              id: data.document.id,
              title: data.document.name,
              url: data.document.documentFilePath,
              fileSize: data.document.size,
              expiresAt: data.document.expiresAt ? new Date(data.document.expiresAt) : undefined,
              finalizationMode: data.document.finalizationMode,
              signingMethod: data.document.signingMethod,
            },
            recipients: otherRecipients.map((r: any) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              role: r.role as 'signer' | 'viewer' | 'cc',
              signingOrder: r.signingOrder,
            })),
            signingOrder: data.document.requireSequentialSigning ? 'sequential' : 'parallel',
            userWillSign: !!ownerRecipient,
            userDisplayName: ownerRecipient?.name || null,
            ownerParticipantId: ownerRecipient?.id || undefined,
            duplicateAnnotations: data.annotations,
          },
        });
      } catch (error) {
        console.error('Error hydrating from duplicate:', error);
        toast({
          title: 'Error',
          description: 'Failed to load duplicate document data',
          variant: 'destructive',
        });
      } finally {
        setIsHydrating(false);
      }
    };

    hydrate();
  }, [duplicateFrom, dispatch, state.document.id]);

  // Function to check if we can proceed to the next step
  const canMoveForward = () => {
    switch (state.currentStep) {
      case 1:
        return state.stepValidation.step1Valid;
      case 2:
        return state.stepValidation.step2Valid;
      case 3:
        return state.stepValidation.step3Valid;
      case 4:
        return state.stepValidation.step4Valid;
      default:
        return false;
    }
  };

  // Function to save document as template
  const saveAsTemplate = async () => {
    if (!state.document.url) return;

    try {
      // Get document details from state
      const documentTitle = state.document.templateName || state.document.title;
      const fileUrl = state.document.url;

      // Get file type from the URL
      const fileType = fileUrl.split('.').pop() || '';

      // Get file size from state if available or use 0 as fallback
      const fileSize = state.document.fileSize || 0;

      // Call the templates API to save the template
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: documentTitle,
          file_url: fileUrl,
          file_type: fileType,
          file_size: fileSize,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      // Display success message
      toast({
        title: 'Template Saved',
        description: 'Your document has been saved as a template.',
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save the template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Function to create document in database
  const createDocument = async () => {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.document.title,
          documentFilePath: state.document.url,
          templateId: state.document.templateId,
          expiresAt: state.document.expiresAt?.toISOString(),
          size: state.document.fileSize,
          requireSequentialSigning: state.signingOrder === 'sequential',
          packetManifest: state.document.packetManifest,
          finalizationMode: state.document.finalizationMode,
          signingMethod: state.document.signingMethod,
        }),
      });

      const result = (await response.json()) as { document?: { id: string }; error?: string };
      if (!response.ok || !result.document) {
        throw new Error(result.error || 'Failed to create document');
      }

      const { document } = result;

      // Save document ID to state
      dispatch({ type: 'SET_DOCUMENT_ID', payload: document.id });

      return document.id;
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: 'Error',
        description: 'Failed to create document. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Function to save recipients to database
  const saveRecipients = async () => {
    if (!state.document.id) {
      console.error('Cannot save recipients: document ID is missing');
      return;
    }

    try {
      // Build recipients list - include the frontend ID to ensure field annotations match
      const recipientsList = state.recipients.map((r) => ({
        id: r.id, // Pass frontend ID to maintain consistency with field annotations
        name: r.name,
        email: r.email,
        accessLevel: r.role.toUpperCase(),
        signingOrder: state.signingOrder === 'sequential' ? r.signingOrder : 0,
        isRequired: r.role === 'signer',
      }));

      // If user will sign, add them as a recipient
      // The backend will use the session user's ID when email is empty
      if (state.userWillSign && state.userDisplayName) {
        // Determine signing order for the owner
        // If there are other recipients, owner signs last (after all others)
        const ownerSigningOrder =
          state.signingOrder === 'sequential' && recipientsList.length > 0
            ? Math.max(...recipientsList.map((r) => r.signingOrder)) + 1
            : 0;

        recipientsList.push({
          id: state.ownerParticipantId, // Use stable ID for field annotation matching
          name: state.userDisplayName,
          email: '', // Empty email signals backend to use session user
          accessLevel: 'SIGNER',
          signingOrder: ownerSigningOrder,
          isRequired: true,
        });
      }

      const response = await fetch(`/api/documents/${state.document.id}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: recipientsList,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save recipients');
      }
    } catch (error) {
      console.error('Error saving recipients:', error);
      toast({
        title: 'Error',
        description: 'Failed to save recipients. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Function to save field annotations to database
  const saveFieldAnnotations = async () => {
    if (!state.document.id) {
      console.error('Cannot save fields: document ID is missing');
      return;
    }

    try {
      // Get viewer instance from context
      const viewerInstance = viewerInstanceRef.current;

      if (!viewerInstance) {
        console.error('Viewer instance not available');
        toast({
          title: 'Error',
          description: 'Viewer not ready. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Export InstantJSON from viewer
      const instantJSON = await viewerInstance.exportInstantJSON();

      const response = await fetch(`/api/documents/${state.document.id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annotationData: instantJSON,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save field annotations');
      }
    } catch (error) {
      console.error('Error saving field annotations:', error);
      toast({
        title: 'Error',
        description: 'Failed to save field placements. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Function to handle moving to the next step
  const handleNext = async () => {
    if (state.currentStep === state.totalSteps) {
      // Document submission is now handled in the ReviewAndSend component
      // No need to do anything special here, just let the UI component handle it
      return;
    } else if (canMoveForward()) {
      // If moving from step 1, create the document in the database
      if (state.currentStep === 1 && !state.document.id) {
        try {
          await createDocument();

          // If user wants to save as template, do that too
          if (state.document.saveAsTemplate) {
            await saveAsTemplate();
          }
        } catch {
          // Don't proceed if document creation failed
          return;
        }
      }

      // If moving from step 2, save recipients to the database
      if (state.currentStep === 2) {
        try {
          await saveRecipients();
        } catch {
          // Don't proceed if recipient saving failed
          return;
        }
      }

      // If moving from step 3, save field annotations to the database
      if (state.currentStep === 3) {
        try {
          await saveFieldAnnotations();
        } catch {
          // Don't proceed if field annotation saving failed
          return;
        }
      }

      // Move to the next step
      dispatch({ type: 'SET_STEP', payload: state.currentStep + 1 });
    } else {
      // If we can't move forward, dispatch a custom event to trigger validation in the current step
      window.dispatchEvent(new Event('beforeDocumentFlowNext'));
    }
  };

  // Function to handle moving to the previous step
  const handleBack = () => {
    if (state.currentStep > 1) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep - 1 });
    }
  };

  return (
    <>
      <StepIndicator currentStep={state.currentStep} totalSteps={state.totalSteps} />

      <div className="card" style={{ padding: 'var(--space-5)' }}>
        {isHydrating ? (
          <div className="empty" style={{ padding: 'var(--space-7) 0' }}>
            <h3>Loading document…</h3>
          </div>
        ) : typeof children === 'function' ? (
          children(state)
        ) : (
          children
        )}
      </div>

      <NavigationControls
        currentStep={state.currentStep}
        totalSteps={state.totalSteps}
        canMoveForward={canMoveForward()}
        onNext={handleNext}
        onBack={handleBack}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
