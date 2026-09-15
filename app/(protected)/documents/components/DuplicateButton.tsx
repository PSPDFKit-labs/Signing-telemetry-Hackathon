'use client';

import { Copy } from '@react-zero-ui/icon-sprite';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface DuplicateButtonProps {
  documentId: string;
  documentName: string;
}

export function DuplicateButton({ documentId, documentName }: DuplicateButtonProps) {
  const router = useRouter();
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicate = async () => {
    setIsDuplicating(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate document');
      }

      const { document } = await response.json();

      toast({
        title: 'Document Duplicated',
        description: `Created "Copy of ${documentName}"`,
      });

      router.push(`/send?duplicateFrom=${document.id}`);
    } catch (error) {
      console.error('Error duplicating document:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate document',
        variant: 'destructive',
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="cursor-pointer text-blue-600 hover:text-blue-700"
      onClick={handleDuplicate}
      disabled={isDuplicating}
      title={`Duplicate "${documentName}"`}
      aria-label={`Duplicate "${documentName}"`}
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}
