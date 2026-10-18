// "Not bringing" items drop out of the count entirely — the list is done when everything
// you are bringing is packed. One definition shared by the packing API routes, the packing
// tab, the trip overview and push reminders, so they never disagree.
export function packingCounts(items: { packed?: boolean; skipped?: boolean }[] = []) {
  const bringing = items.filter(i => !i.skipped);
  const packed   = bringing.filter(i => i.packed).length;
  return {
    total:    bringing.length,
    packed,
    skipped:  items.length - bringing.length,
    progress: bringing.length ? Math.round((packed / bringing.length) * 100) : 0,
  };
}
