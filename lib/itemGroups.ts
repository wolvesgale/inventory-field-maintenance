export const ITEM_GROUPS = [
  'すべて',
  'SAD',
  'BU',
  'CA',
  'FR',
  'EG',
  'CF',
  'MA',
  'その他',
] as const;

export type ItemGroup = (typeof ITEM_GROUPS)[number];

const GROUP_KEYS = ITEM_GROUPS.filter((g) => g !== 'すべて' && g !== 'その他');

const groupMatchPatterns: Record<string, RegExp[]> = GROUP_KEYS.reduce(
  (acc, group) => {
    const pattern = new RegExp(`^${group}[\s\-_/\[]?`, 'i');
    acc[group] = [pattern];
    return acc;
  },
  {} as Record<string, RegExp[]>
);

export function detectItemGroup(itemName: string, itemCode?: string, category?: string): ItemGroup {
  const upperName = (itemName ?? '').trim();
  const upperCode = (itemCode ?? '').trim();
  const upperCategory = (category ?? '').trim();

  for (const group of GROUP_KEYS) {
    const patterns = groupMatchPatterns[group];
    if (patterns.some((regex) => regex.test(upperName) || regex.test(upperCode) || regex.test(upperCategory))) {
      return group as ItemGroup;
    }
  }

  return 'その他';
}

export function normalizeGroupParam(value: string | null): ItemGroup {
  if (!value) return 'すべて';

  const normalized = value.trim().toUpperCase();
  if (normalized === 'ALL' || normalized === 'すべて'.toUpperCase()) {
    return 'すべて';
  }
  if (normalized === 'OTHER' || normalized === 'その他'.toUpperCase()) {
    return 'その他';
  }

  const matched = GROUP_KEYS.find((group) => group.toUpperCase() === normalized);
  return matched ? (matched as ItemGroup) : 'すべて';
}
