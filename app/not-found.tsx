import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-semibold">404 - Page Not Found</h1>
      <p className="mt-4 text-center">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      <Link href="/" className="mt-6 rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600">
        Return Home
      </Link>
    </div>
  );
}
