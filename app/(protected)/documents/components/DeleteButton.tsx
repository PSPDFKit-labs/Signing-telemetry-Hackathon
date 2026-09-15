'use client';

import { Trash2 } from '@react-zero-ui/icon-sprite';
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

interface DeleteButtonProps {
  documentId: string;
  documentName: string;
}

export function DeleteButton({ documentId, documentName }: DeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/delete`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      toast({
        title: 'Document Deleted',
        description: 'Document moved to trash',
      });

      router.refresh();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="cursor-pointer text-red-600 hover:text-red-700"
        onClick={() => setShowDeleteDialog(true)}
        disabled={isDeleting}
        aria-label={`Delete "${documentName}"`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{documentName}&rdquo;? You can restore it from Trash later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
