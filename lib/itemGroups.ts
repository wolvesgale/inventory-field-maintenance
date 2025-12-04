export const GROUP_CODES = ['SAD', 'BU', 'CA', 'FR', 'EG', 'CF', 'MA'] as const;

export type ItemGroup = (typeof GROUP_CODES)[number] | 'その他';

export function getItemGroup(name: string): ItemGroup {
  const raw = (name ?? '').toString().trim();
  const withoutBullet = raw.replace(/^■\s*/, '');
  const head = withoutBullet.slice(0, 5).toUpperCase();

  for (const code of GROUP_CODES) {
    if (head.includes(code)) return code as ItemGroup;
  }

  if (!/^[A-Z]/.test(withoutBullet)) {
    return 'その他';
  }

  return 'その他';
}
