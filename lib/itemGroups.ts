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

export const PRIMARY_GROUP_KEYS: ItemGroupKey[] = [
  'SAD',
  'BU',
  'CA',
  'FR',
  'EG',
  'CF',
  'MA',
];

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

export function resolveGroupFromInitial(initial: string | undefined | null): ItemGroupKey {
  const normalized = (initial ?? '').trim().toUpperCase();

  for (const key of PRIMARY_GROUP_KEYS) {
    if (normalized.startsWith(key)) return key;
  }

  if (!normalized) return 'OTHER';

  return 'OTHER';
}
