import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripPacking from '@/lib/mongodb/models/TripPacking';
import MasterPackingItem from '@/lib/mongodb/models/MasterPackingItem';
import User from '@/lib/mongodb/models/User';
import { getCountryMeta } from '@/lib/data/countries';
import {
  runPackingEngine,
  deriveWeatherContext,
  derivePassportStatus,
  type TripContext,
} from '@/lib/data/packing-conditional-engine';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user    = await User.findOne({ email: session.user.email });
  const trip    = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const logistics = await TripLogistics.findOne({ tripId: id });

  // ── Transport types ──────────────────────────────────────────────────────────
  const transportTypes: string[] = [];
  if (logistics?.transport?.length) {
    for (const t of logistics.transport) {
      if (t.type === 'flight'  && !transportTypes.includes('plane'))  transportTypes.push('plane');
      if (t.type === 'train'   && !transportTypes.includes('train'))  transportTypes.push('train');
      if (t.type === 'car'     && !transportTypes.includes('car'))    transportTypes.push('car');
      if (t.type === 'ferry'   && !transportTypes.includes('ferry'))  transportTypes.push('ferry');
      if (t.type === 'bus'     && !transportTypes.includes('bus'))    transportTypes.push('bus');
      if (t.type === 'rental'  && !transportTypes.includes('car'))    transportTypes.push('car');
    }
  }

  // ── Accommodation types ──────────────────────────────────────────────────────
  const accommodationTypes: string[] = [];
  if (logistics?.accommodation?.length) {
    for (const a of logistics.accommodation) {
      if (!accommodationTypes.includes(a.type)) accommodationTypes.push(a.type);
    }
  }

  const nights   = trip.nights || 1;
  const tripType = trip.tripType || 'leisure';

  // ── Currency zone check ──────────────────────────────────────────────────────
  const originCode  = trip.origin?.countryCode || user.homeLocation?.countryCode;
  const destCode    = trip.destination?.countryCode;
  const originMeta  = originCode ? getCountryMeta(originCode) : null;
  const destMeta    = destCode   ? getCountryMeta(destCode)   : null;
  const sameCurrencyZone = !!(originMeta && destMeta && originMeta.currency === destMeta.currency);

  // ── Passport status ──────────────────────────────────────────────────────────
  const passportStatus = derivePassportStatus(
    user.passport?.expiry ?? null,
    trip.endDate ?? null,
  );

  // ── Weather context (read from stored trip.weather — no API call needed) ─────
  const weatherContext = deriveWeatherContext(trip.weather?.days ?? null);

  // ── Assemble engine context ──────────────────────────────────────────────────
  const engineCtx: TripContext = {
    weather:            weatherContext,
    transportTypes,
    accommodationTypes,
    tripType,
    nights,
    sameCurrencyZone,
    passportStatus,
    destCountryCode:    destCode || '',
  };

  const engineResult = runPackingEngine(engineCtx);

  // ── Trip type filters for master catalogue ────────────────────────────────────
  const tripTypeFilters = ['always'];
  if (tripType === 'work')    tripTypeFilters.push('work', 'business');
  if (tripType === 'leisure') tripTypeFilters.push('leisure');
  if (tripType === 'mixed')   tripTypeFilters.push('work', 'business', 'leisure', 'mixed');

  // ── Fetch and filter master catalogue ────────────────────────────────────────
  const allItems = await MasterPackingItem.find({});

  const selectedItems = allItems.filter((item: any) => {
    if (engineResult.suppressItems.includes(item.name)) return false;

    const tripTypeMatch =
      item.tripTypes?.includes('always') ||
      item.tripTypes?.some((t: string) => tripTypeFilters.includes(t));

    const transportMatch =
      !item.transportTypes?.length ||
      item.transportTypes.some((t: string) => transportTypes.includes(t));

    const accommodationMatch =
      !item.accommodationTypes?.length ||
      item.accommodationTypes.some((t: string) => accommodationTypes.includes(t));

    return tripTypeMatch && transportMatch && accommodationMatch;
  });

  // ── Build packing items from catalogue ───────────────────────────────────────
  const packingItems = selectedItems.map((item: any) => {
    let quantity = item.quantity || 1;

    if (item.quantityType === 'per_night') {
      quantity = Math.round(item.quantity * nights);
      if (item.quantityMin) quantity = Math.max(quantity, item.quantityMin);
      if (item.quantityMax) quantity = Math.min(quantity, item.quantityMax);
    }

    // Apply pre-travel suppression
    const suppressPreTravel = engineResult.suppressPreTravel.includes(item.name);

    // Apply field overrides from engine
    const override = engineResult.itemOverrides[item.name] ?? {};

    return {
      masterItemId:    item._id,
      name:            item.name,
      category:        item.category,
      quantity,
      quantityType:    item.quantityType,
      essential:       override.essential       ?? item.essential,
      packed:          false,
      packedAt:        null,
      preTravelAction: suppressPreTravel ? false : (override.preTravelAction ?? item.preTravelAction),
      preTravelNote:   suppressPreTravel ? ''    : (override.preTravelNote   ?? item.preTravelNote ?? ''),
      advisoryNote:    override.advisoryNote    ?? item.advisoryNote ?? '',
      conditionReason: override.conditionReason ?? '',
      photoUrl:        item.photoUrl,
      source:          'auto',
    };
  });

  // ── Append engine-generated conditional items ─────────────────────────────────
  // Deduplicate by name — don't add if master catalogue already has it
  const existingNames = new Set(packingItems.map((i: any) => i.name));

  for (const ci of engineResult.itemsToAdd) {
    if (!existingNames.has(ci.name)) {
      packingItems.push({
        ...ci,
        masterItemId: null,
        photoUrl: null,
      });
      existingNames.add(ci.name);
    } else {
      // Item exists in catalogue — apply override instead
      const idx = packingItems.findIndex((i: any) => i.name === ci.name);
      if (idx !== -1) {
        packingItems[idx] = {
          ...packingItems[idx],
          essential:       ci.essential       || packingItems[idx].essential,
          advisoryNote:    ci.advisoryNote     || packingItems[idx].advisoryNote,
          conditionReason: ci.conditionReason  || packingItems[idx].conditionReason,
        };
      }
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────────
  const packing = await TripPacking.findOneAndUpdate(
    { tripId: id },
    {
      tripId: id,
      items:  packingItems,
      totalItems:       packingItems.length,
      packedItems:      0,
      packingProgress:  0,
      generatedAt:      new Date(),
      generationParams: {
        nights,
        tripType,
        transportTypes,
        accommodationTypes,
        weatherSnapshot: weatherContext ? {
          avgHigh:   weatherContext.avgHigh,
          avgLow:    weatherContext.avgLow,
          minLow:    weatherContext.minLow,
          maxHigh:   weatherContext.maxHigh,
          hasRain:   weatherContext.hasRain,
          heavyRain: weatherContext.heavyRain,
          rainDays:  weatherContext.rainDays,
        } : null,
        sameCurrencyZone,
        passportState: passportStatus.state,
      },
    },
    { upsert: true, new: true },
  );

  return NextResponse.json({ packing });
}