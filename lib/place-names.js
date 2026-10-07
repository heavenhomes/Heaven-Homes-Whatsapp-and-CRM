/**
 * City / area names are typed by admins and by WhatsApp users in mixed
 * case ("pal", "PAL", "Pal"). These helpers collapse that to one
 * comparable key and one Title Case display value.
 */

export function placeKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function toTitleCase(value) {
  const key = placeKey(value);
  if (!key) return '';
  return key.replace(/\b([\p{L}])/gu, (ch) => ch.toUpperCase());
}

export function uniqueTitleCase(values) {
  const seen = new Map();
  for (const raw of values || []) {
    const key = placeKey(raw);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, toTitleCase(raw));
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function samePlace(a, b) {
  const ka = placeKey(a);
  const kb = placeKey(b);
  return Boolean(ka) && ka === kb;
}

export function matchPlace(input, candidates) {
  const key = placeKey(input);
  if (!key) return null;

  const list = candidates || [];
  const exact = list.find((c) => placeKey(c) === key);
  if (exact) return toTitleCase(exact);

  if (key.length < 3) return null;

  const fuzzyKeys = new Map();
  for (const c of list) {
    const ck = placeKey(c);
    if (!ck) continue;
    if (ck.includes(key) || key.includes(ck)) {
      fuzzyKeys.set(ck, toTitleCase(c));
    }
  }
  if (fuzzyKeys.size === 1) return fuzzyKeys.values().next().value;
  return null;
}

export function placeRegex(value) {
  const key = placeKey(value);
  if (!key) return null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

export function placeQuery(field, value) {
  const regex = placeRegex(value);
  if (!regex) return null;
  return { [field]: { $regex: regex.source, $options: 'i' } };
}

export function formatPlaceList(values, limit = 25) {
  const unique = uniqueTitleCase(values);
  if (unique.length === 0) return '';
  if (unique.length <= limit) return unique.join(', ');
  return `${unique.slice(0, limit).join(', ')}…`;
}
