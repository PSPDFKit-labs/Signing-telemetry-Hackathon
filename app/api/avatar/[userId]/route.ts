import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { users } from '@/database/drizzle/auth-schema';
import { db } from '@/database/drizzle/drizzle';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const result = await db.select({ photo: users.photo }).from(users).where(eq(users.id, userId)).limit(1);

  if (result.length === 0 || !result[0].photo) {
    return new NextResponse(null, { status: 404 });
  }

  // Parse the data URI: "data:<contentType>;base64,<data>"
  const dataUri = result[0].photo;
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType = match[1];
  const buffer = Buffer.from(match[2], 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
