/**
 * Packing Conditional Engine
 *
 * Takes a trip context object and returns:
 *   - itemsToAdd:          weather/context-derived items not in master catalogue
 *   - suppressPreTravel:   names of items whose preTravelAction should be zeroed
 *   - suppressItems:       names of items to exclude entirely from the final list
 *   - itemOverrides:       map of item name → field overrides (e.g. make essential true, change advisoryNote)
 *
 * This runs AFTER the master catalogue filter in the generate route.
 * It does not touch the database — it only transforms the item list.
 */

// ─── Context shape (assembled in generate route) ─────────────────────────────

export interface WeatherContext {
  avgHigh:    number;   // average of all tempMax across trip days
  avgLow:     number;   // average of all tempMin
  minLow:     number;   // coldest overnight (worst case)
  maxHigh:    number;   // hottest daytime (worst case)
  tempRange:  number;   // maxHigh − minLow across entire trip
  hasRain:    boolean;  // any day with chanceOfRain >= 40
  heavyRain:  boolean;  // any day with chanceOfRain >= 60
  rainDays:   number;   // count of days with chanceOfRain >= 40
}

export interface TripContext {
  weather:            WeatherContext | null;
  transportTypes:     string[];         // 'plane' | 'train' | 'car' | 'ferry' | 'bus'
  accommodationTypes: string[];         // 'hotel' | 'airbnb' | 'hostel' | 'camping' | 'family'
  tripType:           string;           // 'work' | 'leisure' | 'mixed'
  nights:             number;
  sameCurrencyZone:   boolean;          // origin and dest share same currency
  passportStatus:     PassportStatus;
  destCountryCode:    string;
}

export type PassportStatus =
  | { state: 'none' }                          // no passport data on user profile
  | { state: 'ok'; daysValidBeyondReturn: number }
  | { state: 'warn'; daysValidBeyondReturn: number; message: string }
  | { state: 'critical'; message: string };    // expired before return date

// ─── Output shapes ────────────────────────────────────────────────────────────

export interface ConditionalItem {
  name:            string;
  category:        string;
  quantity:        number;
  quantityType:    'fixed' | 'per_night';
  essential:       boolean;
  packed:          false;
  packedAt:        null;
  preTravelAction: boolean;
  preTravelNote:   string;
  advisoryNote:    string;
  conditionReason: string;  // shown in UI — "Added: forecast lows of 3°C"
  source:          'auto';
}

export interface ItemOverride {
  essential?:       boolean;
  advisoryNote?:    string;
  preTravelAction?: boolean;
  preTravelNote?:   string;
  conditionReason?: string;
}

export interface EngineResult {
  itemsToAdd:       ConditionalItem[];
  suppressPreTravel: string[];          // item names — zero out preTravelAction flag
  suppressItems:     string[];          // item names — exclude entirely
  itemOverrides:     Record<string, ItemOverride>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function item(
  name: string,
  category: string,
  opts: Partial<ConditionalItem> & { conditionReason: string },
): ConditionalItem {
  return {
    name,
    category,
    quantity:        1,
    quantityType:    'fixed',
    essential:       false,
    packed:          false,
    packedAt:        null,
    preTravelAction: false,
    preTravelNote:   '',
    advisoryNote:    '',
    source:          'auto',
    ...opts,
  };
}

// ─── Derive WeatherContext from stored trip.weather.days ──────────────────────

export function deriveWeatherContext(
  days: Array<{
    tempMax:       number;
    tempMin:       number;
    chanceOfRain:  number;
    precipMm?:     number;
  }> | null | undefined,
): WeatherContext | null {
  if (!days || days.length === 0) return null;

  const highs     = days.map(d => d.tempMax);
  const lows      = days.map(d => d.tempMin);
  const avgHigh   = Math.round(highs.reduce((a, b) => a + b, 0) / highs.length);
  const avgLow    = Math.round(lows.reduce((a, b) => a + b, 0) / lows.length);
  const minLow    = Math.min(...lows);
  const maxHigh   = Math.max(...highs);
  const rainDays  = days.filter(d => d.chanceOfRain >= 40).length;

  return {
    avgHigh,
    avgLow,
    minLow,
    maxHigh,
    tempRange:  maxHigh - minLow,
    hasRain:    rainDays > 0,
    heavyRain:  days.some(d => d.chanceOfRain >= 60),
    rainDays,
  };
}

// ─── Derive PassportStatus ────────────────────────────────────────────────────
//
// Rules:
//   1. If passport expires before trip endDate → critical
//   2. If passport has < 6 months validity beyond trip endDate → warn (many countries require this)
//   3. If passport expires within 9 months from TODAY → warn with renewal lead-time note
//      (Irish passport renewal can take 6–8 weeks; 9 months gives a comfortable window)
//   4. Otherwise → ok

export function derivePassportStatus(
  passportExpiry: Date | null | undefined,
  tripEndDate:    Date | null | undefined,
): PassportStatus {
  if (!passportExpiry || !tripEndDate) return { state: 'none' };

  const today    = new Date();
  const expiry   = new Date(passportExpiry);
  const endDate  = new Date(tripEndDate);

  const msPerDay = 86400000;
  const daysUntilExpiry       = Math.floor((expiry.getTime() - today.getTime())    / msPerDay);
  const daysValidBeyondReturn = Math.floor((expiry.getTime() - endDate.getTime())  / msPerDay);

  // Expired before return — can't get home
  if (daysValidBeyondReturn < 0) {
    return {
      state:   'critical',
      message: `Passport expires ${Math.abs(daysValidBeyondReturn)} day${Math.abs(daysValidBeyondReturn) !== 1 ? 's' : ''} before your return date — you may not be able to travel`,
    };
  }

  // Less than 6 months validity beyond return — many countries will refuse entry
  if (daysValidBeyondReturn < 180) {
    return {
      state: 'warn',
      daysValidBeyondReturn,
      message: `Passport has only ${daysValidBeyondReturn} days validity beyond your return date — most countries require 6 months. Renew before travel.`,
    };
  }

  // Passport is fine for this trip but will expire within 9 months from today
  // — flag it so the user knows to start renewal process now
  if (daysUntilExpiry < 270) {
    return {
      state: 'warn',
      daysValidBeyondReturn,
      message: `Passport expires in ${daysUntilExpiry} days. Even though it covers this trip, consider renewing now — Irish passport renewals can take 6–8 weeks or longer in peak season.`,
    };
  }

  return { state: 'ok', daysValidBeyondReturn };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function runPackingEngine(ctx: TripContext): EngineResult {
  const result: EngineResult = {
    itemsToAdd:        [],
    suppressPreTravel: [],
    suppressItems:     [],
    itemOverrides:     {},
  };

  const { weather, transportTypes, accommodationTypes, tripType, nights } = ctx;

  // ── 1. CURRENCY ZONE ────────────────────────────────────────────────────────
  // If travelling within the same currency zone (e.g. Ireland → Germany, both EUR):
  // suppress the cash pre-travel action and update the advisory note.
  if (ctx.sameCurrencyZone) {
    result.suppressPreTravel.push('Cash (local currency)');
    result.itemOverrides['Cash (local currency)'] = {
      advisoryNote:    'Same currency zone — no exchange needed. Carry some cash for small vendors and markets.',
      conditionReason: 'Eurozone destination — exchange rate not applicable',
    };
  }

  // ── 2. PASSPORT ─────────────────────────────────────────────────────────────
  if (ctx.passportStatus.state === 'none') {
    // No passport data — flag the item as pre-travel so user adds expiry to profile
    result.itemOverrides['Passport'] = {
      preTravelAction: true,
      preTravelNote:   'Add your passport expiry date to your profile so TripMaster can check validity automatically.',
      advisoryNote:    'Passport expiry not set in your profile',
    };
  } else if (ctx.passportStatus.state === 'ok') {
    // Passport is fine — suppress the pre-travel action, just pack it
    result.suppressPreTravel.push('Passport');
    result.itemOverrides['Passport'] = {
      advisoryNote: `Valid for ${ctx.passportStatus.daysValidBeyondReturn} days beyond return`,
    };
  } else if (ctx.passportStatus.state === 'warn') {
    result.itemOverrides['Passport'] = {
      preTravelAction: true,
      preTravelNote:   ctx.passportStatus.message,
      essential:       true,
    };
  } else if (ctx.passportStatus.state === 'critical') {
    result.itemOverrides['Passport'] = {
      preTravelAction: true,
      preTravelNote:   ctx.passportStatus.message,
      essential:       true,
    };
  }

  // ── 3. WEATHER ──────────────────────────────────────────────────────────────

  if (weather) {

    // ── 3a. COLD (overnight lows ≤ 8°C) ──
    if (weather.minLow <= 8) {
      const reason = `Forecast lows of ${weather.minLow}°C`;

      // Warm layers — essential when cold, regardless of whether user has them catalogued
      result.itemsToAdd.push(item('Warm layers / fleece', 'Clothes', {
        essential:       true,
        conditionReason: reason,
        advisoryNote:    `Evenings drop to ${weather.minLow}°C — pack at least one warm mid-layer`,
      }));

      // Thermal underwear if very cold (< 5°C nights)
      if (weather.minLow < 5) {
        result.itemsToAdd.push(item('Thermal base layer', 'Clothes', {
          essential:       true,
          quantity:        2,
          conditionReason: `${reason} — thermals recommended below 5°C`,
          advisoryNote:    'Overnight temperatures dropping below 5°C',
        }));
      }

      // Promote jacket/coat to essential
      result.itemOverrides['Jacket / coat'] = {
        essential:       true,
        advisoryNote:    `Forecast lows of ${weather.minLow}°C — a warm jacket is essential`,
        conditionReason: reason,
      };
    }

    // ── 3b. HOT (daytime highs ≥ 22°C) ──
    if (weather.maxHigh >= 22) {
      const reason = `Forecast highs of ${weather.maxHigh}°C`;

      result.itemOverrides['Sunscreen'] = {
        essential:       true,
        advisoryNote:    `Highs of ${weather.maxHigh}°C forecast — high UV exposure`,
        conditionReason: reason,
      };

      result.itemsToAdd.push(item('Sun hat', 'Accessories', {
        essential:       true,
        conditionReason: reason,
        advisoryNote:    `Daytime temperatures reaching ${weather.maxHigh}°C`,
      }));

      // Shorts if leisure or mixed
      if (tripType !== 'work') {
        result.itemsToAdd.push(item('Shorts / light bottoms', 'Clothes', {
          essential:       true,
          quantity:        Math.min(Math.ceil(nights / 2), 4),
          conditionReason: reason,
        }));
      }

      // Sandals if not a work trip
      if (tripType !== 'work') {
        result.itemsToAdd.push(item('Sandals / open shoes', 'Clothes', {
          conditionReason: reason,
        }));
      }
    }

    // ── 3c. RAIN ──
    if (weather.hasRain) {
      const reason = `Rain forecast on ${weather.rainDays} of ${weather.rainDays >= 3 ? 'your' : 'your'} trip days`;

      // Promote umbrella to essential and override advisory
      result.itemOverrides['Umbrella'] = {
        essential:       true,
        advisoryNote:    `Rain on ${weather.rainDays} day${weather.rainDays !== 1 ? 's' : ''} — compact umbrella worth the space`,
        conditionReason: reason,
      };

      if (weather.heavyRain) {
        result.itemsToAdd.push(item('Waterproof jacket', 'Clothes', {
          essential:       true,
          conditionReason: `Heavy rain forecast (${weather.rainDays} days at 60%+ chance)`,
          advisoryNote:    'An umbrella alone won\'t cut it — waterproof outer layer needed',
        }));

        result.itemsToAdd.push(item('Waterproof shoes / shoe covers', 'Clothes', {
          conditionReason: reason,
          advisoryNote:    'Heavy rain expected — keep your feet dry',
        }));
      }
    }

    // ── 3d. VARIABLE temperature (range > 10°C across the trip) ──
    if (weather.tempRange > 10) {
      const reason = `Temperature swings of ${weather.tempRange}°C across your trip`;

      result.itemsToAdd.push(item('Lightweight packable layer', 'Clothes', {
        essential:       true,
        conditionReason: reason,
        advisoryNote:    `Temperatures ranging ${weather.minLow}°C–${weather.maxHigh}°C — pack layers you can add/remove`,
      }));
    }
  }

  // ── 4. TRANSPORT ─────────────────────────────────────────────────────────────

  if (transportTypes.includes('plane')) {
    // Liquid bag already in master catalogue — just make sure it's there
    // Promote compression socks note for long-haul (nights proxy: if > 3 nights it's likely long-haul)
    if (nights >= 3) {
      result.itemOverrides['Compression socks'] = {
        advisoryNote:    'Recommended for flights over 4 hours — reduces swelling and DVT risk',
        conditionReason: 'Flying long-haul',
      };
    }
  }

  if (transportTypes.includes('ferry')) {
    result.itemOverrides['Motion sickness medication'] = {
      essential:       true,
      conditionReason: 'Ferry transport — rough crossings can be unpredictable',
    };
  }

  // ── 5. ACCOMMODATION ─────────────────────────────────────────────────────────

  if (accommodationTypes.includes('family')) {
    // Suppress towel pre-travel action — family hosts will have towels
    result.suppressPreTravel.push('Quick-dry towel');
    // Remove beach/hostel towel items if staying with family
    result.suppressItems.push('Quick-dry towel');
    result.itemOverrides['Personal towel'] = {
      advisoryNote:    'Staying with family — host likely has towels. Bring one to be safe.',
      conditionReason: 'Staying with family/friends',
    };
  }

  if (accommodationTypes.includes('hotel')) {
    // Standard hotels provide soap, shower gel, shampoo, conditioner, and body lotion.
    // Hair dryer is almost always available on request if not in the room.
    // Suppress these entirely — no point packing them.
    const hotelProvided = [
      'Shower gel / soap',
      'Shampoo (travel size)',
      'Conditioner (travel size)',
      'Body lotion',
      'Hair dryer',
    ];
    for (const name of hotelProvided) {
      result.suppressItems.push(name);
    }

    // Towel — hotels always provide. Suppress quick-dry travel towel.
    result.suppressItems.push('Quick-dry towel');

    // If the ONLY accommodation is hotel (not mixed with camping/hostel),
    // add an advisory note to the packing list so the user understands why these are absent.
    // (We don't add an item — we just surface this as a generationParams note,
    //  handled in the generate route via the weatherSnapshot equivalent.)
  }

  if (accommodationTypes.includes('hostel')) {
    result.itemOverrides['Eye mask'] = {
      essential:       true,
      conditionReason: 'Hostel accommodation — dorm lighting and noise',
    };
    result.itemOverrides['Earplugs'] = {
      essential:       true,
      conditionReason: 'Hostel accommodation — shared dorm',
    };
    // Hostels do NOT reliably provide toiletries — keep them in the list
  }

  if (accommodationTypes.includes('airbnb')) {
    // Airbnbs vary — some provide basics, many don't. Keep toiletries in list.
    // Towel — most airbnbs provide but not guaranteed. Keep quick-dry towel.
  }

  // ── 6. TRIP TYPE ─────────────────────────────────────────────────────────────

  if (tripType === 'work' || tripType === 'mixed') {
    // Laptop bag check — ensure it's in the list
    result.itemOverrides['Laptop'] = {
      preTravelAction: true,
      preTravelNote:   'Charge fully before packing. Check charger and all adapters are packed too.',
    };
  }

  return result;
}