import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { getCountryMeta, getCountryName, COUNTRY_LIST } from '@/lib/data/countries';
import { getPhrasesForCountry, ENGLISH_SPEAKING, ESSENTIAL_PHRASE_IDS } from '@/lib/data/phrases';
import { countriesDatabase } from '@/lib/data/countries-database';
import { getVisaRequirement, hasVisaDataForPassport } from '@/lib/data/visa-rules';

// Resolve a country code from either a stored code or a country name string.
function resolveCountryCode(code?: string, name?: string): string | null {
  if (code) return code;
  if (!name) return null;
  return COUNTRY_LIST.find(c => c.name.toLowerCase() === name.toLowerCase())?.code ?? null;
}

function getTimezoneOffset(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(new Date());
    const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+0';
    const match = offsetStr.match(/GMT([+-]\d+(?::\d+)?)/);
    if (!match) return 0;
    const [hours, minutes = '0'] = match[1].split(':');
    return parseInt(hours) + (parseInt(minutes) / 60) * Math.sign(parseInt(hours));
  } catch {
    return 0;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const destCode   = resolveCountryCode(trip.destination?.countryCode, trip.destination?.country);
  if (!destCode) return NextResponse.json({ error: 'No destination country on trip' }, { status: 400 });

  const originCode = resolveCountryCode(user.homeLocation?.countryCode, user.homeLocation?.country);
  const destMeta   = getCountryMeta(destCode);
  const originMeta = originCode ? getCountryMeta(originCode) : null;

  // Extended metadata from countries-database (tipping, water, payment, cultural)
  const destExtended   = countriesDatabase.getCountryMetadata(destCode);
  const originExtended = originCode ? countriesDatabase.getCountryMetadata(originCode) : null;

  // ── ELECTRICAL ──────────────────────────────────────────────────────────────
  const electrical = originMeta ? (() => {
    const needsAdapter = originMeta.electricalPlug !== destMeta.electricalPlug;
    return {
      needsAdapter,
      originPlug: originMeta.electricalPlug,
      destinationPlug: destMeta.electricalPlug,
      adapterType: needsAdapter ? `${originMeta.electricalPlug} → ${destMeta.electricalPlug}` : null,
      message: needsAdapter
        ? `You'll need a ${originMeta.electricalPlug} → ${destMeta.electricalPlug} adapter`
        : `Your ${originMeta.electricalPlug} plugs will work — no adapter needed`,
    };
  })() : null;

  // ── CURRENCY ────────────────────────────────────────────────────────────────
  const currency = originMeta ? (() => {
    const needsExchange = originMeta.currency !== destMeta.currency;
    return {
      needsExchange,
      originCurrency: originMeta.currency,
      originSymbol: originMeta.currencySymbol,
      destinationCurrency: destMeta.currency,
      destinationSymbol: destMeta.currencySymbol,
      message: needsExchange
        ? `Exchange ${originMeta.currency} → ${destMeta.currency} (${destMeta.currencySymbol}) before travel`
        : `Same currency (${originMeta.currency}) — no exchange needed`,
    };
  })() : null;

  // ── LANGUAGE ────────────────────────────────────────────────────────────────
  const language = (() => {
    const destIsEnglish = ENGLISH_SPEAKING.has(destCode);
    const sameLanguage  = destIsEnglish || (originMeta?.language === destMeta.language);
    const phrases       = getPhrasesForCountry(destCode);
    return {
      sameLanguage: !!sameLanguage,
      destinationLanguage: destMeta.language,
      destinationLanguageLocal: phrases?.localName ?? null,
      phrasesAvailable: !!phrases,
      essentialPhrases: phrases ? phrases.phrases.filter(p => ESSENTIAL_PHRASE_IDS.includes(p.id)) : [],
      allPhrases: phrases?.phrases ?? [],
      message: sameLanguage
        ? `${destMeta.language} spoken — easy communication`
        : `${destMeta.language} spoken — essential phrases below`,
    };
  })();

  // ── TIMEZONE ────────────────────────────────────────────────────────────────
  const timezone = (() => {
    const destOffset   = getTimezoneOffset(destMeta.timezone);
    const originOffset = originMeta ? getTimezoneOffset(originMeta.timezone) : destOffset;
    const diff         = destOffset - originOffset;
    const absDiff      = Math.abs(diff);
    let jetlagRisk: 'none' | 'mild' | 'moderate' | 'significant' = 'none';
    if (absDiff >= 8)      jetlagRisk = 'significant';
    else if (absDiff >= 5) jetlagRisk = 'moderate';
    else if (absDiff >= 2) jetlagRisk = 'mild';
    return {
      destinationTimezone: destMeta.timezone,
      originTimezone: originMeta?.timezone ?? null,
      hoursDifference: diff,
      absDifference: absDiff,
      jetlagRisk,
      direction: diff > 0 ? 'ahead' : diff < 0 ? 'behind' : 'same',
      message: absDiff === 0
        ? 'Same timezone — no adjustment needed'
        : `${getCountryName(destCode)} is ${absDiff} hour${absDiff !== 1 ? 's' : ''} ${diff > 0 ? 'ahead of' : 'behind'} home`,
    };
  })();

  // ── EMERGENCY ───────────────────────────────────────────────────────────────
  const emergency = {
    number:  destMeta.emergency,
    country: getCountryName(destCode),
    message: `Emergency number in ${getCountryName(destCode)}: ${destMeta.emergency}`,
  };

  // ── DRIVING ─────────────────────────────────────────────────────────────────
  const driving = originMeta ? (() => {
    const sameSide = originMeta.drivingSide === destMeta.drivingSide;
    return {
      destinationSide: destMeta.drivingSide,
      originSide: originMeta.drivingSide,
      sameAshome: sameSide,
      message: sameSide
        ? `Drive on the ${destMeta.drivingSide} — same as home`
        : `Drive on the ${destMeta.drivingSide} — opposite to home`,
    };
  })() : null;

  // ── PASSPORT ────────────────────────────────────────────────────────────────
  const passport = user.passport?.expiry ? (() => {
    const expiry      = new Date(user.passport.expiry);
    const tripDate    = trip.startDate ? new Date(trip.startDate) : new Date();
    const daysAtTravel = Math.floor((expiry.getTime() - tripDate.getTime()) / 86400000);
    const isExpired   = daysAtTravel < 0;
    const isWarning   = daysAtTravel < 180;
    return {
      expiry: user.passport.expiry,
      daysAtTravel,
      isWarning,
      isExpired,
      message: isExpired
        ? 'Your passport will be expired at the time of travel!'
        : isWarning
        ? `Passport only has ${daysAtTravel} days validity at travel — most countries require 6 months`
        : `Passport valid for ${daysAtTravel} days at time of travel`,
    };
  })() : null;

  // ── VISA ────────────────────────────────────────────────────────────────────
  const visa = (() => {
    if (!originCode) return null;

    const hasData = hasVisaDataForPassport(originCode);
    if (!hasData) {
      return {
        available: false,
        message: `Visa data not yet available for your passport (${originCode}) — check your government travel advice.`,
      };
    }

    const req = getVisaRequirement(originCode, destCode);
    if (!req) {
      return {
        available: false,
        message: `No visa data found for ${getCountryName(originCode)} → ${getCountryName(destCode)} — check your government travel advice.`,
      };
    }

    const typeLabels: Record<string, string> = {
      none:      'No visa required',
      eta:       'eTA required',
      esta:      'ESTA required',
      evisa:     'e-Visa required',
      voa:       'Visa on arrival',
      visa:      'Visa required',
    };

    return {
      available: true,
      required:  req.required,
      type:      req.type,
      typeLabel: typeLabels[req.type] ?? req.type,
      name:      req.name ?? null,
      cost:      req.cost ?? null,
      processingTime: req.processingTime ?? null,
      applyUrl:  req.applyUrl ?? null,
      maxStay:   req.maxStay,
      notes:     req.notes,
      message:   req.required
        ? `${typeLabels[req.type] ?? 'Visa required'} — ${req.name ?? req.type}`
        : `No visa required — stay up to ${req.maxStay}`,
    };
  })();

  // ── TIPPING ─────────────────────────────────────────────────────────────────
  const tipping = destExtended?.tipping ? {
    culture:     destExtended.tipping.culture,
    restaurants: destExtended.tipping.restaurants,
    taxis:       destExtended.tipping.taxis,
    hotels:      destExtended.tipping.hotels,
    notes:       destExtended.tipping.notes,
    message:     `Tipping is ${destExtended.tipping.culture} — ${destExtended.tipping.restaurants} at restaurants`,
  } : null;

  // ── WATER ───────────────────────────────────────────────────────────────────
  const water = destExtended?.water ? {
    drinkable: destExtended.water.drinkable,
    notes:     destExtended.water.notes,
    message:   destExtended.water.drinkable
      ? `Tap water is safe to drink`
      : `Do not drink tap water — use bottled water`,
  } : null;

  // ── PAYMENT ─────────────────────────────────────────────────────────────────
  const payment = destExtended?.payment ? {
    cashCulture: destExtended.payment.cashCulture,
    contactless: destExtended.payment.contactless,
    notes:       destExtended.payment.notes,
    message:     destExtended.payment.notes,
  } : null;

  // ── CULTURAL ────────────────────────────────────────────────────────────────
  const cultural = destExtended?.cultural ? {
    dressCode: destExtended.cultural.dressCode,
    notes:     destExtended.cultural.notes,
    message:   destExtended.cultural.notes,
  } : null;

  return NextResponse.json({
    intelligence: {
      destination: { country: getCountryName(destCode), countryCode: destCode, city: trip.destination?.city },
      electrical,
      currency,
      language,
      timezone,
      emergency,
      driving,
      passport,
      visa,
      tipping,
      water,
      payment,
      cultural,
    },
  });
}