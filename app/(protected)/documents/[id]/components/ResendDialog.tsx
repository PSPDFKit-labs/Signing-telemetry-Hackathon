'use client';

import { Mail } from '@react-zero-ui/icon-sprite';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

interface Recipient {
  id: string;
  userName: string | null;
  userEmail: string | null;
  signatureStatus: string | null;
  accessLevel: string;
}

interface ResendDialogProps {
  documentId: string;
  documentName: string;
  expiresAt: Date | null;
  recipients: Recipient[];
}

export function ResendDialog({ documentId, documentName, expiresAt, recipients }: ResendDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [newExpiresAt, setNewExpiresAt] = useState(expiresAt ? expiresAt.toISOString().split('T')[0] : '');
  const [message, setMessage] = useState('');
  const [dateError, setDateError] = useState('');

  const signers = useMemo(() => recipients.filter((r) => r.accessLevel === 'SIGNER'), [recipients]);

  function validateDate(value: string): boolean {
    if (!value) {
      setDateError('');
      return true;
    }
    // Compare at day granularity using local midnight to avoid UTC offset issues
    const selected = new Date(`${value}T00:00:00`);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (selected <= todayMidnight) {
      setDateError('Expiry date must be in the future');
      return false;
    }
    setDateError('');
    return true;
  }

  async function handleResend() {
    if (!validateDate(newExpiresAt)) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresAt: newExpiresAt || null,
          emailMessage: message || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend document');
      }

      const emailsSent = typeof data.emailsSent === 'number' ? data.emailsSent : 0;
      toast({
        title: 'Document Resent',
        description: `${emailsSent} email${emailsSent !== 1 ? 's' : ''} sent successfully.`,
      });

      setOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resend document',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  }

  function statusBadge(status: string | null) {
    if (status === 'SIGNED') return <Badge className="text-xs bg-green-600">Signed</Badge>;
    if (status === 'DECLINED')
      return (
        <Badge variant="destructive" className="text-xs">
          Declined
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-xs">
        Pending
      </Badge>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setNewExpiresAt(expiresAt ? expiresAt.toISOString().split('T')[0] : '');
          setMessage('');
          setDateError('');
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-2" aria-hidden="true" />
          Resend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resend Document</DialogTitle>
          <DialogDescription>
            Pending signing links will be rotated and re-sent. Completed signatures are preserved; for sequential
            workflows, only the current signing group is notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Document name */}
          <div>
            <p className="text-sm font-medium mb-1">Document</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{documentName}</p>
          </div>

          {/* Recipients */}
          <div>
            <p className="text-sm font-medium mb-2">Signers ({signers.length})</p>
            <div className="space-y-2">
              {signers.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.userName || 'Unknown'}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{r.userEmail}</p>
                  </div>
                  <div className="ml-2">{statusBadge(r.signatureStatus)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Expiry date */}
          <div>
            <label htmlFor="resend-expires" className="text-sm font-medium block mb-1">
              Expiry date <span className="text-zinc-500 dark:text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              id="resend-expires"
              type="date"
              value={newExpiresAt}
              onChange={(e) => {
                setNewExpiresAt(e.target.value);
                validateDate(e.target.value);
              }}
              className="w-full rounded-md border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
            />
            {dateError && <p className="text-xs text-red-500 mt-1">{dateError}</p>}
          </div>

          {/* Optional message */}
          <div>
            <label htmlFor="resend-message" className="text-sm font-medium block mb-1">
              Message <span className="text-zinc-500 dark:text-zinc-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="resend-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Add a note to the signing email..."
              className="w-full rounded-md border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleResend} disabled={isSending || !!dateError}>
            {isSending ? 'Sending...' : 'Resend to all signers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
