// Shared batching helpers for stores.

// Firestore allows at most 500 writes per WriteBatch. Operations beyond that
// throw and, because a batch is atomic, the entire commit fails — so large
// imports/reorders must be split into chunks. See issue #15.
export const MAX_FIRESTORE_BATCH_OPS = 500;

/**
 * Split an array into consecutive chunks of at most `size` items.
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(items, size) {
  if (!Array.isArray(items) || !Number.isFinite(size) || size <= 0) return [];
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
