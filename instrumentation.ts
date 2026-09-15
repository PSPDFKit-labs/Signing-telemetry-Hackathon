export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DATABASE_URL) {
    const { seedSystemTemplates } = await import('@/lib/seed-system-templates');
    try {
      await seedSystemTemplates();
    } catch (error) {
      console.error('Failed to seed system templates:', error);
    }
  }
}
