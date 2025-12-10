export const ITEM_GROUP_KEYS = [
  'ALL',
  'SAD',
  'BU',
  'CA',
  'FR',
  'EG',
  'CF',
  'MA',
  'OTHER',
] as const;

export type ItemGroupKey = (typeof ITEM_GROUP_KEYS)[number];

export const ITEM_GROUP_LABELS: Record<ItemGroupKey, string> = {
  ALL: 'すべて',
  SAD: 'SAD',
  BU: 'BU',
  CA: 'CA',
  FR: 'FR',
  EG: 'EG',
  CF: 'CF',
  MA: 'MA',
  OTHER: 'その他',
};

export const ITEM_GROUPS: { key: ItemGroupKey; label: string }[] = ITEM_GROUP_KEYS.map((key) => ({
  key,
  label: ITEM_GROUP_LABELS[key],
}));

const PREFIX_GROUPS = ITEM_GROUP_KEYS.filter((key) => key !== 'ALL' && key !== 'OTHER');

const normalizeGroupTarget = (value: string | undefined | null) => {
  const text = (value ?? '').trim().toUpperCase();

  // 先頭に記号が続くケース（例: [FR] いちご）を考慮して、英数字までをスキップ
  let start = 0;
  while (start < text.length && !/[A-Z0-9]/.test(text[start])) {
    start += 1;
  }

  return text.slice(start);
};

export function matchesGroupPrefix(value: string | undefined | null, group: ItemGroupKey) {
  if (!value || group === 'ALL') return true;
  if (group === 'OTHER') return false;

  const normalized = normalizeGroupTarget(value);
  return normalized.startsWith(group);
}

export function detectItemGroup(itemName: string, itemCode?: string): ItemGroupKey {
  const normalizedName = normalizeGroupTarget(itemName);
  const normalizedCode = normalizeGroupTarget(itemCode);

  for (const group of PREFIX_GROUPS) {
    if (normalizedName.startsWith(group) || normalizedCode.startsWith(group)) {
      return group;
    }
  }

  return 'OTHER';
}

export function normalizeGroupParam(value: string | null): ItemGroupKey {
  if (!value) return 'ALL';

  const normalized = value.trim().toUpperCase();

  if (normalized === ITEM_GROUP_LABELS.ALL.toUpperCase()) return 'ALL';
  if (normalized === ITEM_GROUP_LABELS.OTHER.toUpperCase()) return 'OTHER';

  const matched = ITEM_GROUP_KEYS.find((key) => key === normalized);
  return matched ?? 'ALL';
}

export function isItemGroupKey(value: string | undefined | null): value is ItemGroupKey {
  if (!value) return false;
  return ITEM_GROUP_KEYS.includes(value as ItemGroupKey);
}
