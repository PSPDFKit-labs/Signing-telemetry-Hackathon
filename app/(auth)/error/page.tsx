'use client';

import { PenTool } from '@react-zero-ui/icon-sprite';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'An unknown error occurred';

  return (
    <>
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100">
          <PenTool className="h-5 w-5 text-white dark:text-zinc-900" />
        </div>
        <span className="text-lg font-semibold text-gray-900 dark:text-white">Sign</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-semibold">Authentication Error</CardTitle>
          <CardDescription className="text-center">There was a problem signing you in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Try Again
          </Link>
        </CardFooter>
      </Card>
    </>
  );
}
