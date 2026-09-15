import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth-js';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.NUTRIENT_API_KEY;
  const apiBaseUrl = process.env.NUTRIENT_API_BASE_URL || 'https://api.nutrient.io/';

  if (!apiKey) {
    return NextResponse.json({ error: 'NUTRIENT_API_KEY not configured' }, { status: 500 });
  }

  const certificatesUrl = `${apiBaseUrl}i/certificates`;

  const response = await fetch(certificatesUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data.data || data);
}
