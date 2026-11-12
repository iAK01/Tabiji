// A catalogue item as it goes onto a trip's list. Shared by the list generator, adding a
// single catalogue item to a trip, and the copy shown while that add is queued offline.

export interface CatalogueSource<Id = unknown> {
  _id:              Id;
  name:             string;
  category:         string;
  essential?:       boolean;
  quantity?:        number;
  quantityType?:    string;
  quantityMin?:     number;
  quantityMax?:     number;
  preTravelAction?: boolean;
  preTravelNote?:   string;
  advisoryNote?:    string;
  photoUrl?:        string;
}

export function catalogueQuantity(item: Omit<CatalogueSource, '_id' | 'name' | 'category'>, nights: number): number {
  let quantity = item.quantity || 1;
  if (item.quantityType === 'per_night') {
    quantity = Math.round((item.quantity ?? 1) * nights);
    if (item.quantityMin) quantity = Math.max(quantity, item.quantityMin);
    if (item.quantityMax) quantity = Math.min(quantity, item.quantityMax);
  }
  return quantity;
}

/** Added by hand from the catalogue — kept through a regenerate like any manual item. */
export function tripItemFromCatalogue<Id>(m: CatalogueSource<Id>, nights: number) {
  return {
    masterItemId:    m._id,
    name:            m.name,
    category:        m.category,
    quantity:        catalogueQuantity(m, nights),
    quantityType:    m.quantityType ?? 'fixed',
    essential:       !!m.essential,
    packed:          false,
    packedAt:        null,
    preTravelAction: !!m.preTravelAction,
    preTravelNote:   m.preTravelNote ?? '',
    advisoryNote:    m.advisoryNote ?? '',
    photoUrl:        m.photoUrl,
    source:          'manual' as const,
  };
}
