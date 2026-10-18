// Shared by the packing list and the card deck.

export type PackStatus = 'todo' | 'packed' | 'skipped';

export function statusOf(item: { packed?: boolean; skipped?: boolean }): PackStatus {
  return item.packed ? 'packed' : item.skipped ? 'skipped' : 'todo';
}

export function qtyLabel(item: { name: string; quantity: number }): string {
  const q    = item.quantity;
  const name = item.name.toLowerCase();
  if (name.includes('underwear') || name.includes('sock'))    return `${q} pair${q !== 1 ? 's' : ''}`;
  if (name.includes('shirt') || name.includes('t-shirt'))     return `${q} shirt${q !== 1 ? 's' : ''}`;
  if (name.includes('trouser') || name.includes('jean') ||
      name.includes('pant')   || name.includes('short'))      return `${q} pair${q !== 1 ? 's' : ''}`;
  if (name.includes('shoe')   || name.includes('boot'))       return `${q} pair${q !== 1 ? 's' : ''}`;
  if (name.includes('cable')  || name.includes('charger'))    return `${q} cable${q !== 1 ? 's' : ''}`;
  if (name.includes('battery') || name.includes('batteries')) return `${q} spare${q !== 1 ? 's' : ''}`;
  if (q === 1) return '× 1';
  return `× ${q}`;
}
