'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconTrashSmall } from '@/components/sign-design/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';

interface DeleteAllButtonProps {
  documentCount: number;
}

export function DeleteAllButton({ documentCount }: DeleteAllButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleDeleteAll = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch('/api/documents/permanent-delete-all', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete documents');
      }

      const data = await response.json();

      toast({
        title: 'Trash Emptied',
        description: `${data.deletedCount} document${data.deletedCount !== 1 ? 's' : ''} permanently deleted`,
      });

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error deleting all documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete documents',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="btn ghost"
          style={{ color: 'rgb(180, 60, 60)', borderColor: 'rgb(180, 60, 60)' }}
          disabled={isDeleting}
        >
          <IconTrashSmall /> Empty trash
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {documentCount} document{documentCount !== 1 ? 's' : ''} from your trash. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAll}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete All'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
