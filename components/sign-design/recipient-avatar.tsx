export function RecipientAvatar({ name, color }: { name: string; color?: string }) {
  const initials =
    name
      .split(' ')
      .map((s) => s[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return (
    <div className="recipient-avatar" style={color ? { background: color, color: '#0e1525' } : undefined}>
      {initials}
    </div>
  );
}
