'use client';

import { Download, Loader2, Upload } from '@react-zero-ui/icon-sprite';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

export function StartWetSign({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  return (
    <Button
      type="button"
      disabled={starting}
      onClick={async () => {
        setStarting(true);
        try {
          const response = await fetch(`/api/documents/${documentId}/wet-sign`, { method: 'POST' });
          const result = (await response.json()) as { error?: string };
          if (!response.ok) throw new Error(result.error || 'Could not prepare print packet');
          toast({
            title: 'Ready for wet signing',
            description: 'Download the print packet, then upload the signed return.',
          });
          router.refresh();
        } catch (error) {
          toast({
            title: 'Could not start wet signing',
            description: error instanceof Error ? error.message : 'Please retry.',
            variant: 'destructive',
          });
        } finally {
          setStarting(false);
        }
      }}
    >
      {starting ? 'Preparing…' : 'Prepare for wet signing'}
    </Button>
  );
}

export function WetSignActions({ documentId }: { documentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadReturn = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/documents/${documentId}/wet-sign/return`, {
        method: 'POST',
        body: formData,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Upload failed');
      toast({
        title: 'Wet-signed packet reconciled',
        description: 'The returned PDF is now the completed document of record.',
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Return upload failed',
        description: error instanceof Error ? error.message : 'Could not upload returned PDF.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <a className="btn ghost" href={`/api/documents/${documentId}/wet-sign`} download>
        <Download className="h-4 w-4" /> Download print packet
      </a>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadReturn(file);
        }}
      />
      <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Uploading…' : 'Upload signed return'}
      </Button>
    </>
  );
}
