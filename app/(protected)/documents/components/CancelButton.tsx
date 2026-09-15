'use client';

import { XCircle } from '@react-zero-ui/icon-sprite';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface CancelButtonProps {
  documentId: string;
  documentName: string;
  disabled?: boolean;
}

export function CancelButton({ documentId, documentName, disabled }: CancelButtonProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handleCancel = async () => {
    setShowCancelDialog(false);
    setIsCancelling(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel document');
      }

      toast({
        title: 'Document Cancelled',
        description: `${data.cancelledSignatureRequests} pending signature request(s) cancelled. ${data.emailsSent} notification(s) sent.`,
      });

      router.refresh();
    } catch (error) {
      console.error('Error cancelling document:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel document',
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="cursor-pointer text-orange-600 hover:text-orange-700"
        onClick={() => setShowCancelDialog(true)}
        disabled={isCancelling || disabled}
        title={disabled ? 'Cannot cancel this document' : 'Cancel pending signing requests'}
        aria-label={`Cancel "${documentName}"`}
      >
        <XCircle className="h-4 w-4" />
      </Button>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel &ldquo;{documentName}&rdquo;? This will cancel all pending signature
              requests and revoke their signing links. Completed signatures are preserved. Recipient notifications
              require configured email delivery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Document</AlertDialogCancel>
            <AlertDialogAction className="bg-orange-600 text-white hover:bg-orange-700" onClick={handleCancel}>
              Cancel Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
