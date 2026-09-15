'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconRestore, IconTrashSmall } from '@/components/sign-design/icons';
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

interface TrashActionsProps {
  documentId: string;
  documentName: string;
}

export function TrashActions({ documentId, documentName }: TrashActionsProps) {
  const router = useRouter();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to restore document');
      }

      toast({
        title: 'Document Restored',
        description: 'Document has been moved back to Sent',
      });

      router.refresh();
    } catch (error) {
      console.error('Error restoring document:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore document',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/permanent-delete`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to permanently delete document');
      }

      toast({
        title: 'Document Deleted',
        description: 'Document has been permanently removed',
      });

      router.refresh();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to permanently delete document',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
      <button
        type="button"
        className="btn ghost sm"
        onClick={handleRestore}
        disabled={isRestoring || isDeleting}
        title="Restore"
      >
        <IconRestore />
      </button>
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => setShowDeleteDialog(true)}
        disabled={isRestoring || isDeleting}
        title="Delete permanently"
        style={{ color: 'rgb(180, 60, 60)' }}
      >
        <IconTrashSmall />
      </button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete &ldquo;{documentName}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handlePermanentDelete}>
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
