export function matchesSearch(query, ...fields) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => (field || "").toLowerCase().includes(q));
}

export function isSearchActive(query) {
  return query.trim().length > 0;
}
