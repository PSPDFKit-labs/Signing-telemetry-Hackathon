'use client';

import { Loader2 } from '@react-zero-ui/icon-sprite';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export function FinalizeButton({ documentId }: { documentId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function finalize() {
    setPending(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/finalize`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Finalization failed');
      toast({ title: 'Document finalized', description: 'The digitally signed PDF is ready.' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Finalization failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" size="sm" onClick={finalize} disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Retry finalization
    </Button>
  );
}
