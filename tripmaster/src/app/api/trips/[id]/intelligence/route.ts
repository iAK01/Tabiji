import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { getCountryMeta, getCountryName, COUNTRY_LIST } from '@/lib/data/countries';
import { getPhrasesForCountry, ENGLISH_SPEAKING, ESSENTIAL_PHRASE_IDS } from '@/lib/data/phrases';

// Resolve a country code from either a stored code or a country name string.
// Existing trips won't have countryCode — this handles that gracefully.
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

  const destCode = resolveCountryCode(trip.destination?.countryCode, trip.destination?.country);
  if (!destCode) return NextResponse.json({ error: 'No destination country on trip' }, { status: 400 });

  const originCode = resolveCountryCode(user.homeLocation?.countryCode, user.homeLocation?.country);
  const destMeta = getCountryMeta(destCode);
  const originMeta = originCode ? getCountryMeta(originCode) : null;

  // ── ELECTRICAL ──────────────────────────────────────────────────────────
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

  // ── CURRENCY ────────────────────────────────────────────────────────────
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

  // ── LANGUAGE ────────────────────────────────────────────────────────────
  const language = (() => {
    const destIsEnglish = ENGLISH_SPEAKING.has(destCode);
    const sameLanguage = destIsEnglish || (originMeta?.language === destMeta.language);
    const phrases = getPhrasesForCountry(destCode);
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

  // ── TIMEZONE ────────────────────────────────────────────────────────────
  const timezone = (() => {
    const destOffset = getTimezoneOffset(destMeta.timezone);
    const originOffset = originMeta ? getTimezoneOffset(originMeta.timezone) : destOffset;
    const diff = destOffset - originOffset;
    const absDiff = Math.abs(diff);
    let jetlagRisk: 'none' | 'mild' | 'moderate' | 'significant' = 'none';
    if (absDiff >= 8) jetlagRisk = 'significant';
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
        ? 'Same timezone — no jet lag'
        : `${getCountryName(destCode)} is ${absDiff} hour${absDiff !== 1 ? 's' : ''} ${diff > 0 ? 'ahead of' : 'behind'} home`,
    };
  })();

  // ── EMERGENCY ───────────────────────────────────────────────────────────
  const emergency = {
    number: destMeta.emergency,
    country: getCountryName(destCode),
    message: `Emergency number in ${getCountryName(destCode)}: ${destMeta.emergency}`,
  };

  // ── DRIVING ─────────────────────────────────────────────────────────────
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

  // ── PASSPORT ────────────────────────────────────────────────────────────
  const passport = user.passport?.expiry ? (() => {
    const expiry = new Date(user.passport.expiry);
    const tripDate = trip.startDate ? new Date(trip.startDate) : new Date();
    const daysAtTravel = Math.floor((expiry.getTime() - tripDate.getTime()) / 86400000);
    const isExpired = daysAtTravel < 0;
    const isWarning = daysAtTravel < 180;
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
    },
  });
}