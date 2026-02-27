// data/countries-database.js - Complete Country dropdown and metadata
export const countriesDatabase = {
  // Main dropdown list - ~59 major travel destinations
  dropdownList: [
    // Europe (Major destinations)
    { code: 'AT', name: 'Austria', region: 'Europe' },
    { code: 'BE', name: 'Belgium', region: 'Europe' },
    { code: 'BG', name: 'Bulgaria', region: 'Europe' },
    { code: 'HR', name: 'Croatia', region: 'Europe' },
    { code: 'CZ', name: 'Czech Republic', region: 'Europe' },
    { code: 'DK', name: 'Denmark', region: 'Europe' },
    { code: 'EE', name: 'Estonia', region: 'Europe' },
    { code: 'FI', name: 'Finland', region: 'Europe' },
    { code: 'FR', name: 'France', region: 'Europe' },
    { code: 'DE', name: 'Germany', region: 'Europe' },
    { code: 'GR', name: 'Greece', region: 'Europe' },
    { code: 'HU', name: 'Hungary', region: 'Europe' },
    { code: 'IS', name: 'Iceland', region: 'Europe' },
    { code: 'IE', name: 'Ireland', region: 'Europe' },
    { code: 'IT', name: 'Italy', region: 'Europe' },
    { code: 'LV', name: 'Latvia', region: 'Europe' },
    { code: 'LT', name: 'Lithuania', region: 'Europe' },
    { code: 'LU', name: 'Luxembourg', region: 'Europe' },
    { code: 'MT', name: 'Malta', region: 'Europe' },
    { code: 'NL', name: 'Netherlands', region: 'Europe' },
    { code: 'NO', name: 'Norway', region: 'Europe' },
    { code: 'PL', name: 'Poland', region: 'Europe' },
    { code: 'PT', name: 'Portugal', region: 'Europe' },
    { code: 'RO', name: 'Romania', region: 'Europe' },
    { code: 'SK', name: 'Slovakia', region: 'Europe' },
    { code: 'SI', name: 'Slovenia', region: 'Europe' },
    { code: 'ES', name: 'Spain', region: 'Europe' },
    { code: 'SE', name: 'Sweden', region: 'Europe' },
    { code: 'CH', name: 'Switzerland', region: 'Europe' },
    { code: 'GB', name: 'United Kingdom', region: 'Europe' },

    // North America
    { code: 'CA', name: 'Canada', region: 'North America' },
    { code: 'MX', name: 'Mexico', region: 'North America' },
    { code: 'US', name: 'United States', region: 'North America' },

    // Asia Pacific (Major destinations)
    { code: 'AU', name: 'Australia', region: 'Asia Pacific' },
    { code: 'CN', name: 'China', region: 'Asia Pacific' },
    { code: 'HK', name: 'Hong Kong', region: 'Asia Pacific' },
    { code: 'IN', name: 'India', region: 'Asia Pacific' },
    { code: 'ID', name: 'Indonesia', region: 'Asia Pacific' },
    { code: 'JP', name: 'Japan', region: 'Asia Pacific' },
    { code: 'MY', name: 'Malaysia', region: 'Asia Pacific' },
    { code: 'NZ', name: 'New Zealand', region: 'Asia Pacific' },
    { code: 'PH', name: 'Philippines', region: 'Asia Pacific' },
    { code: 'SG', name: 'Singapore', region: 'Asia Pacific' },
    { code: 'KR', name: 'South Korea', region: 'Asia Pacific' },
    { code: 'TW', name: 'Taiwan', region: 'Asia Pacific' },
    { code: 'TH', name: 'Thailand', region: 'Asia Pacific' },
    { code: 'VN', name: 'Vietnam', region: 'Asia Pacific' },

    // Middle East & Africa (Major business/tourist hubs)
    { code: 'EG', name: 'Egypt', region: 'Middle East & Africa' },
    { code: 'IL', name: 'Israel', region: 'Middle East & Africa' },
    { code: 'JO', name: 'Jordan', region: 'Middle East & Africa' },
    { code: 'KE', name: 'Kenya', region: 'Middle East & Africa' },
    { code: 'MA', name: 'Morocco', region: 'Middle East & Africa' },
    { code: 'ZA', name: 'South Africa', region: 'Middle East & Africa' },
    { code: 'AE', name: 'United Arab Emirates', region: 'Middle East & Africa' },

    // South America (Major destinations)
    { code: 'AR', name: 'Argentina', region: 'South America' },
    { code: 'BR', name: 'Brazil', region: 'South America' },
    { code: 'CL', name: 'Chile', region: 'South America' },
    { code: 'CO', name: 'Colombia', region: 'South America' },
    { code: 'PE', name: 'Peru', region: 'South America' }
  ],

  // Country metadata for enhanced functionality - ALL COUNTRIES
  countryMetadata: {

    // ===== EUROPE =====

    'AT': {
      timezone: 'Europe/Vienna',
      currency: 'EUR', currencySymbol: '€',
      language: 'German',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'expected', restaurants: '5–10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Round up bills rather than leaving a percentage' },
      water: { drinkable: true, notes: 'Tap water is excellent quality throughout Austria' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards widely accepted; some smaller places prefer cash' },
      cultural: { dressCode: 'smart casual', notes: 'Austrians value punctuality and formality. Greet with a handshake.' }
    },

    'BE': {
      timezone: 'Europe/Brussels',
      currency: 'EUR', currencySymbol: '€',
      language: 'Dutch/French/German',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/E',
      tipping: { culture: 'appreciated', restaurants: '5–10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Service is often included; extra tip appreciated but not required' },
      water: { drinkable: true, notes: 'Tap water is safe to drink throughout Belgium' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards and contactless widely accepted everywhere' },
      cultural: { dressCode: 'smart casual', notes: 'Bilingual country — use French in Wallonia, Dutch in Flanders. Business culture is formal.' }
    },

    'BG': {
      timezone: 'Europe/Sofia',
      currency: 'BGN', currencySymbol: 'лв',
      language: 'Bulgarian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '1–2 lev/bag', notes: 'Tipping is common and appreciated; leave cash directly' },
      water: { drinkable: false, notes: 'Tap water is technically safe but locals and visitors often drink bottled' },
      payment: { cashCulture: 'cash-heavy', contactless: true, notes: 'Carry cash, especially outside Sofia. Card acceptance improving.' },
      cultural: { dressCode: 'smart casual', notes: 'Note: Bulgarians shake head for yes and nod for no — opposite to most cultures.' }
    },

    'HR': {
      timezone: 'Europe/Zagreb',
      currency: 'EUR', currencySymbol: '€',
      language: 'Croatian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Tipping not mandatory but appreciated, especially in tourist areas' },
      water: { drinkable: true, notes: 'Tap water is safe and good quality throughout Croatia' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards accepted in cities; carry cash for smaller towns and markets' },
      cultural: { dressCode: 'smart casual', notes: 'Dress modestly when visiting churches. Coastal areas are relaxed.' }
    },

    'CZ': {
      timezone: 'Europe/Prague',
      currency: 'CZK', currencySymbol: 'Kč',
      language: 'Czech',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/E',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '20–50 Kč/bag', notes: 'Tell the server the total you want to pay when they bring change' },
      water: { drinkable: true, notes: 'Tap water is safe throughout Czech Republic' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Note: Czech Republic uses Koruna (CZK), not Euro. Cards widely accepted in Prague.' },
      cultural: { dressCode: 'smart casual', notes: 'Czechs are reserved initially but warm up quickly. Punctuality respected.' }
    },

    'DK': {
      timezone: 'Europe/Copenhagen',
      currency: 'DKK', currencySymbol: 'kr',
      language: 'Danish',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/E/F/K',
      tipping: { culture: 'optional', restaurants: '0–10%', taxis: 'Round up', hotels: 'Not expected', notes: 'Service included in bills. Tip only if service was exceptional.' },
      water: { drinkable: true, notes: 'Tap water is among the best in the world in Denmark' },
      payment: { cashCulture: 'cashless', contactless: true, notes: 'Denmark is nearly cashless — cards and MobilePay accepted almost everywhere' },
      cultural: { dressCode: 'casual', notes: 'Danes value equality and informality. Hygge culture — relaxed and welcoming.' }
    },

    'EE': {
      timezone: 'Europe/Tallinn',
      currency: 'EUR', currencySymbol: '€',
      language: 'Estonian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1/bag', notes: 'Not obligatory but appreciated, especially in Tallinn restaurants' },
      water: { drinkable: true, notes: 'Tap water is safe to drink throughout Estonia' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'One of Europe\'s most digitally advanced countries — cards accepted almost everywhere' },
      cultural: { dressCode: 'smart casual', notes: 'Estonians are reserved but direct. Silence in conversation is normal and not awkward.' }
    },

    'FI': {
      timezone: 'Europe/Helsinki',
      currency: 'EUR', currencySymbol: '€',
      language: 'Finnish',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'optional', restaurants: '0–10%', taxis: 'Not expected', hotels: 'Not expected', notes: 'Tipping not culturally embedded; round up if satisfied' },
      water: { drinkable: true, notes: 'Finnish tap water is some of the cleanest in the world' },
      payment: { cashCulture: 'cashless', contactless: true, notes: 'Finland is highly cashless — cards accepted virtually everywhere including small vendors' },
      cultural: { dressCode: 'casual', notes: 'Finns are quiet and value personal space. Direct communication. Sauna culture is important.' }
    },

    'FR': {
      timezone: 'Europe/Paris',
      currency: 'EUR', currencySymbol: '€',
      language: 'French',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/E',
      tipping: { culture: 'appreciated', restaurants: '5–10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Service compris (included) on bills. Extra tip appreciated but never obligatory.' },
      water: { drinkable: true, notes: 'Tap water is safe throughout France. Ask for une carafe d\'eau (free) in restaurants.' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards widely accepted. Some small cafés and markets prefer cash.' },
      cultural: { dressCode: 'smart casual', notes: 'Always greet with Bonjour — entering a shop without greeting is considered rude. Dress well in Paris.' }
    },

    'DE': {
      timezone: 'Europe/Berlin',
      currency: 'EUR', currencySymbol: '€',
      language: 'German',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'expected', restaurants: '5–10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Tell the server the total you want to pay (Stimmt so) rather than leaving cash on the table' },
      water: { drinkable: true, notes: 'German tap water is high quality and safe everywhere' },
      payment: { cashCulture: 'cash-heavy', contactless: true, notes: 'Germany uses more cash than most EU countries. Many restaurants and smaller shops are cash-only.' },
      cultural: { dressCode: 'smart casual', notes: 'Punctuality is essential. Direct communication style — not rudeness. Titles and formality matter in business.' }
    },

    'GR': {
      timezone: 'Europe/Athens',
      currency: 'EUR', currencySymbol: '€',
      language: 'Greek',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Leave cash on the table. Tipping is appreciated but service can be slow regardless.' },
      water: { drinkable: false, notes: 'Tap water safe in Athens and most cities; use bottled on islands to be safe' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards accepted in cities; carry cash on islands and for smaller establishments' },
      cultural: { dressCode: 'modest at religious sites', notes: 'Cover shoulders and knees at churches and monasteries. Greeks are warm and hospitable.' }
    },

    'HU': {
      timezone: 'Europe/Budapest',
      currency: 'HUF', currencySymbol: 'Ft',
      language: 'Hungarian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'expected', restaurants: '10–15%', taxis: 'Round up', hotels: '200–500 Ft/bag', notes: 'Do not leave tip on table — tell the server directly how much to charge' },
      water: { drinkable: true, notes: 'Budapest tap water is safe; bottled widely preferred by locals' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Hungary uses Forint (HUF). Cards accepted in most places; keep some cash for smaller venues.' },
      cultural: { dressCode: 'smart casual', notes: 'Hungarians are formal initially. Handshakes for greetings. Wine and food culture is important.' }
    },

    'IS': {
      timezone: 'Atlantic/Reykjavik',
      currency: 'ISK', currencySymbol: 'kr',
      language: 'Icelandic',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'not expected', restaurants: 'Not customary', taxis: 'Not expected', hotels: 'Not expected', notes: 'Tipping is not part of Icelandic culture; wages are high and service is included' },
      water: { drinkable: true, notes: 'Icelandic tap water is some of the purest in the world — straight from glacial springs' },
      payment: { cashCulture: 'cashless', contactless: true, notes: 'Iceland is almost entirely cashless. Cards accepted everywhere including remote locations.' },
      cultural: { dressCode: 'casual', notes: 'Egalitarian society — informal and friendly. Nature must be treated with great respect.' }
    },

    'IE': {
      timezone: 'Europe/Dublin',
      currency: 'EUR', currencySymbol: '€',
      language: 'English',
      emergency: '999',
      drivingSide: 'left',
      electricalPlug: 'G',
      tipping: { culture: 'appreciated', restaurants: '10–15%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Not obligatory but common in restaurants. Pub rounds are a social norm.' },
      water: { drinkable: true, notes: 'Irish tap water is safe throughout the country' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards and contactless widely accepted everywhere in Ireland' },
      cultural: { dressCode: 'casual', notes: 'Irish people are warm and sociable. Pub culture is central. Sense of humour is valued.' }
    },

    'IT': {
      timezone: 'Europe/Rome',
      currency: 'EUR', currencySymbol: '€',
      language: 'Italian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F/L',
      tipping: { culture: 'appreciated', restaurants: '5–10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Coperto (cover charge) often included. Standing at bar is cheaper than sitting. Tip in cash.' },
      water: { drinkable: true, notes: 'Tap water safe in most of Italy. Look for Acqua Potabile signs. Free public fountains everywhere.' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Many small trattorias and markets prefer cash. Cards improving but carry euros.' },
      cultural: { dressCode: 'smart — cover up for churches', notes: 'Dress modestly for religious sites. Italians dress well generally. Meal times are sacred — no early dining.' }
    },

    'LV': {
      timezone: 'Europe/Riga',
      currency: 'EUR', currencySymbol: '€',
      language: 'Latvian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1/bag', notes: 'Not obligatory but appreciated in restaurants and for good service' },
      water: { drinkable: true, notes: 'Tap water is safe in Riga and across Latvia' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards accepted widely; contactless common in Riga' },
      cultural: { dressCode: 'smart casual', notes: 'Latvians are reserved initially. Direct and honest communication style.' }
    },

    'LT': {
      timezone: 'Europe/Vilnius',
      currency: 'EUR', currencySymbol: '€',
      language: 'Lithuanian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1/bag', notes: 'Not obligatory but common in Vilnius restaurants and hotels' },
      water: { drinkable: true, notes: 'Tap water is safe throughout Lithuania' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards widely accepted; Vilnius is very card-friendly' },
      cultural: { dressCode: 'smart casual', notes: 'Lithuanians are private but hospitable once comfortable. Dress smartly for business.' }
    },

    'LU': {
      timezone: 'Europe/Luxembourg',
      currency: 'EUR', currencySymbol: '€',
      language: 'Luxembourgish/French/German',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Service often included; extra tip appreciated for good service' },
      water: { drinkable: true, notes: 'Tap water is excellent quality throughout Luxembourg' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards and contactless accepted almost everywhere' },
      cultural: { dressCode: 'smart', notes: 'Luxembourg is a wealthy, formal business hub. Dress professionally. Trilingual — try French or German.' }
    },

    'MT': {
      timezone: 'Europe/Malta',
      currency: 'EUR', currencySymbol: '€',
      language: 'Maltese/English',
      emergency: '112',
      drivingSide: 'left',
      electricalPlug: 'G',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1/bag', notes: 'Not obligatory; appreciated for good service. English widely spoken.' },
      water: { drinkable: true, notes: 'Technically safe but heavily chlorinated — most visitors use bottled water' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards accepted in tourist areas; carry cash for smaller villages and markets' },
      cultural: { dressCode: 'modest at churches', notes: 'Strong Catholic culture — cover up at churches. Maltese are friendly and English-speaking.' }
    },

    'NL': {
      timezone: 'Europe/Amsterdam',
      currency: 'EUR', currencySymbol: '€',
      language: 'Dutch',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '5–10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Not obligatory but common. Round up or leave 10% in restaurants.' },
      water: { drinkable: true, notes: 'Dutch tap water is excellent quality — one of the best in Europe' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Netherlands is very card-friendly. Note: some places only accept Maestro/iDEAL — not all accept Visa/Mastercard.' },
      cultural: { dressCode: 'casual', notes: 'Dutch are direct to the point of bluntness — not rudeness. Cycling culture is dominant; respect bike lanes.' }
    },

    'NO': {
      timezone: 'Europe/Oslo',
      currency: 'NOK', currencySymbol: 'kr',
      language: 'Norwegian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'optional', restaurants: '10%', taxis: 'Round up', hotels: 'Not expected', notes: 'Service included in prices. Tip only if genuinely impressed.' },
      water: { drinkable: true, notes: 'Norwegian tap water is pristine — safe to drink from rivers in the mountains too' },
      payment: { cashCulture: 'cashless', contactless: true, notes: 'Norway is almost entirely cashless. Cards and Vipps (app) accepted everywhere.' },
      cultural: { dressCode: 'casual', notes: 'Egalitarian society. Norwegians respect personal space and are reserved in public.' }
    },

    'PL': {
      timezone: 'Europe/Warsaw',
      currency: 'PLN', currencySymbol: 'zł',
      language: 'Polish',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/E',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '5–10 zł/bag', notes: 'Tell the waiter the total you wish to pay when they bring change' },
      water: { drinkable: true, notes: 'Tap water is safe in major cities; bottled widely preferred by locals' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Poland uses Złoty (PLN). Cards widely accepted; contactless very popular. Carry some cash.' },
      cultural: { dressCode: 'smart casual', notes: 'Poles are hospitable and proud of their culture. Dress modestly for churches.' }
    },

    'PT': {
      timezone: 'Europe/Lisbon',
      currency: 'EUR', currencySymbol: '€',
      language: 'Portuguese',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '5–10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Leave cash on table. Couvert (bread/snacks) on table are charged — send back if unwanted.' },
      water: { drinkable: true, notes: 'Tap water is safe throughout Portugal; Lisbon tap water is particularly good' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards widely accepted in cities; carry cash for rural areas and local markets' },
      cultural: { dressCode: 'smart casual', notes: 'Portuguese are warm but more reserved than Spanish. Saudade culture — melancholic and reflective.' }
    },

    'RO': {
      timezone: 'Europe/Bucharest',
      currency: 'RON', currencySymbol: 'lei',
      language: 'Romanian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '5–10 lei/bag', notes: 'Tipping is expected, especially in Bucharest. Leave cash directly with server.' },
      water: { drinkable: false, notes: 'Tap water technically safe in Bucharest but use bottled to be safe; avoid tap water in rural areas' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Romania uses Leu (RON). Carry cash outside Bucharest; cards improving in cities.' },
      cultural: { dressCode: 'smart casual', notes: 'Romanians are welcoming. Dress modestly at religious sites. Superstitions and traditions are important.' }
    },

    'SK': {
      timezone: 'Europe/Bratislava',
      currency: 'EUR', currencySymbol: '€',
      language: 'Slovak',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/E',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1/bag', notes: 'Tell the waiter what you wish to pay; appreciated but not obligatory' },
      water: { drinkable: true, notes: 'Tap water is safe throughout Slovakia' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards accepted in Bratislava; carry cash outside the capital' },
      cultural: { dressCode: 'smart casual', notes: 'Slovaks are reserved but friendly. Formal in business settings.' }
    },

    'SI': {
      timezone: 'Europe/Ljubljana',
      currency: 'EUR', currencySymbol: '€',
      language: 'Slovenian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '€1/bag', notes: 'Not obligatory; appreciated for good service in restaurants' },
      water: { drinkable: true, notes: 'Slovenia has excellent tap water — some of the cleanest in Europe' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards widely accepted throughout Slovenia' },
      cultural: { dressCode: 'smart casual', notes: 'Slovenians are environmentally conscious and outdoorsy. Respectful and punctual.' }
    },

    'ES': {
      timezone: 'Europe/Madrid',
      currency: 'EUR', currencySymbol: '€',
      language: 'Spanish',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '5–10%', taxis: 'Round up', hotels: '€1–2/bag', notes: 'Not obligatory. Leave small change or round up. Tipping less embedded than in US.' },
      water: { drinkable: true, notes: 'Tap water is safe throughout Spain, though taste varies by region' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards widely accepted; contactless very common. Some smaller bars prefer cash.' },
      cultural: { dressCode: 'smart casual', notes: 'Late meal times — dinner rarely before 9pm. Siesta culture in smaller towns. Cover up at churches.' }
    },

    'SE': {
      timezone: 'Europe/Stockholm',
      currency: 'SEK', currencySymbol: 'kr',
      language: 'Swedish',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'optional', restaurants: '5–10%', taxis: 'Round up', hotels: 'Not expected', notes: 'Included in prices but rounding up appreciated. Swish app used for payments.' },
      water: { drinkable: true, notes: 'Swedish tap water is excellent — safe and tasty everywhere' },
      payment: { cashCulture: 'cashless', contactless: true, notes: 'Sweden is almost cashless — Swish app dominates. Many places refuse cash entirely.' },
      cultural: { dressCode: 'casual', notes: 'Lagom culture — moderation and equality. Swedes respect queuing and personal space.' }
    },

    'CH': {
      timezone: 'Europe/Zurich',
      currency: 'CHF', currencySymbol: 'Fr',
      language: 'German/French/Italian',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/J',
      tipping: { culture: 'appreciated', restaurants: '5–10%', taxis: 'Round up', hotels: 'CHF 1–2/bag', notes: 'Service included by law; extra tip for good service. Very expensive country.' },
      water: { drinkable: true, notes: 'Swiss tap water is exceptional — often straight from mountain springs' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards accepted widely but Switzerland uses Swiss Franc (CHF) — Euro not always accepted' },
      cultural: { dressCode: 'smart', notes: 'Punctuality is non-negotiable. Quiet hours (Ruhezeit) strictly observed. Four language regions have different cultures.' }
    },

    'GB': {
      timezone: 'Europe/London',
      currency: 'GBP', currencySymbol: '£',
      language: 'English',
      emergency: '999',
      drivingSide: 'left',
      electricalPlug: 'G',
      tipping: { culture: 'expected', restaurants: '10–15%', taxis: 'Round up', hotels: '£1–2/bag', notes: 'Check if service charge already added to bill. Pub rounds are a strong social norm.' },
      water: { drinkable: true, notes: 'UK tap water is safe throughout. Ask for tap water in restaurants — it\'s free.' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Contactless dominant — many places now card-only. Tap limit is high.' },
      cultural: { dressCode: 'smart casual', notes: 'Queuing is sacred. Understatement and irony are communication norms. Pub culture is central.' }
    },

    // ===== NORTH AMERICA =====

    'CA': {
      timezone: 'America/Toronto',
      currency: 'CAD', currencySymbol: 'C$',
      language: 'English/French',
      emergency: '911',
      drivingSide: 'right',
      electricalPlug: 'A/B',
      tipping: { culture: 'expected', restaurants: '15–20%', taxis: '15%', hotels: 'C$2–5/bag', notes: 'Tipping is cultural and expected. Pre-set tip options on payment terminals start at 18%.' },
      water: { drinkable: true, notes: 'Canadian tap water is safe in all major cities' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards and contactless widely accepted. Interac (debit) is dominant in Canada.' },
      cultural: { dressCode: 'casual', notes: 'Canadians are polite and apologetic. French mandatory in Quebec. Multicultural and inclusive.' }
    },

    'MX': {
      timezone: 'America/Mexico_City',
      currency: 'MXN', currencySymbol: '$',
      language: 'Spanish',
      emergency: '911',
      drivingSide: 'right',
      electricalPlug: 'A/B',
      tipping: { culture: 'expected', restaurants: '10–15%', taxis: 'Round up', hotels: '20–50 MXN/bag', notes: 'USD tips accepted in tourist areas. Essential for service workers who rely on tips.' },
      water: { drinkable: false, notes: 'Do not drink tap water in Mexico — use bottled or purified water exclusively' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Carry cash (pesos) especially outside cities. Cards accepted in tourist areas and malls.' },
      cultural: { dressCode: 'smart casual', notes: 'Warm and family-oriented culture. Punctuality flexible socially but expected in business. Dress modestly at churches.' }
    },

    'US': {
      timezone: 'America/New_York',
      currency: 'USD', currencySymbol: '$',
      language: 'English',
      emergency: '911',
      drivingSide: 'right',
      electricalPlug: 'A/B',
      tipping: { culture: 'mandatory', restaurants: '18–22%', taxis: '15–20%', hotels: '$2–5/bag', notes: 'Tipping is not optional — service workers\' wages depend on it. Tip at coffee shops, bars, everywhere.' },
      water: { drinkable: true, notes: 'Tap water is safe throughout the US. Quality and taste vary by city.' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards dominant; contactless and Apple/Google Pay widely accepted. Some places card-only.' },
      cultural: { dressCode: 'casual to smart', notes: 'Friendly and direct. Sales tax added at register (not shown on prices). Healthcare is expensive — ensure travel insurance.' }
    },

    // ===== ASIA PACIFIC =====

    'AU': {
      timezone: 'Australia/Sydney',
      currency: 'AUD', currencySymbol: 'A$',
      language: 'English',
      emergency: '000',
      drivingSide: 'left',
      electricalPlug: 'I',
      tipping: { culture: 'optional', restaurants: '0–10%', taxis: 'Round up', hotels: 'Not expected', notes: 'Tipping not culturally embedded. Staff earn good wages. Tip only for exceptional service.' },
      water: { drinkable: true, notes: 'Australian tap water is safe in all cities and towns' },
      payment: { cashCulture: 'cashless', contactless: true, notes: 'Australia leads the world in contactless payments — tap-and-go everywhere' },
      cultural: { dressCode: 'casual', notes: 'Relaxed, egalitarian culture. Tall poppy syndrome — don\'t boast. Sun protection is essential.' }
    },

    'CN': {
      timezone: 'Asia/Shanghai',
      currency: 'CNY', currencySymbol: '¥',
      language: 'Mandarin',
      emergency: '110',
      drivingSide: 'right',
      electricalPlug: 'A/C/I',
      tipping: { culture: 'not expected', restaurants: 'Not customary', taxis: 'Not expected', hotels: 'Not expected', notes: 'Tipping is not part of Chinese culture and can occasionally cause offence' },
      water: { drinkable: false, notes: 'Never drink tap water in China — use bottled or boiled water only' },
      payment: { cashCulture: 'cashless', contactless: false, notes: 'WeChat Pay and Alipay dominate. Foreign cards increasingly difficult. Bring cash as backup. Set up WeChat Pay before arrival.' },
      cultural: { dressCode: 'smart casual', notes: 'Face (mianzi) is crucial — avoid public confrontation. Google, WhatsApp, Instagram blocked — use VPN. Business cards with two hands.' }
    },

    'HK': {
      timezone: 'Asia/Hong_Kong',
      currency: 'HKD', currencySymbol: 'HK$',
      language: 'Cantonese/English',
      emergency: '999',
      drivingSide: 'left',
      electricalPlug: 'G',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: 'HK$10–20/bag', notes: 'Service charge (10%) usually added to restaurant bills. Leave small change for taxis.' },
      water: { drinkable: true, notes: 'Tap water meets WHO standards but locals often use filtered or bottled water' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Octopus card essential for transport. Cards and contactless widely accepted.' },
      cultural: { dressCode: 'smart casual', notes: 'Fast-paced, efficient city. English widely spoken. Business culture is professional and punctual.' }
    },

    'IN': {
      timezone: 'Asia/Kolkata',
      currency: 'INR', currencySymbol: '₹',
      language: 'Hindi/English',
      emergency: '112',
      drivingSide: 'left',
      electricalPlug: 'C/D/M',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '₹50–100/bag', notes: 'Tips (baksheesh) expected. Bargaining normal in markets. Agree price before taxi journey.' },
      water: { drinkable: false, notes: 'Never drink tap water in India. Use sealed bottled water for drinking and brushing teeth.' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'UPI payments (PhonePe, Paytm) dominant. Cards in cities; cash essential elsewhere. ATMs available.' },
      cultural: { dressCode: 'modest — cover shoulders and knees', notes: 'Remove shoes at temples. Use right hand for eating and greetings. Cows are sacred. Vegetarian options everywhere.' }
    },

    'ID': {
      timezone: 'Asia/Jakarta',
      currency: 'IDR', currencySymbol: 'Rp',
      language: 'Indonesian',
      emergency: '112',
      drivingSide: 'left',
      electricalPlug: 'C/F',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: 'Rp 10,000–20,000/bag', notes: 'Service charge often included in tourist areas. Leave cash for hotel staff.' },
      water: { drinkable: false, notes: 'Do not drink tap water in Indonesia — use bottled water only' },
      payment: { cashCulture: 'cash-heavy', contactless: true, notes: 'Carry cash (Rupiah) especially outside Bali/Jakarta. GoPay and OVO apps popular.' },
      cultural: { dressCode: 'modest — cover up at temples', notes: 'Predominantly Muslim country — dress modestly outside tourist areas. Remove shoes at temples. Left hand considered unclean.' }
    },

    'JP': {
      timezone: 'Asia/Tokyo',
      currency: 'JPY', currencySymbol: '¥',
      language: 'Japanese',
      emergency: '119',
      drivingSide: 'left',
      electricalPlug: 'A/B',
      tipping: { culture: 'offensive', restaurants: 'Do not tip', taxis: 'Do not tip', hotels: 'Do not tip', notes: 'Tipping is considered rude in Japan — staff may chase after you to return the money' },
      water: { drinkable: true, notes: 'Japanese tap water is excellent quality and safe throughout the country' },
      payment: { cashCulture: 'cash-heavy', contactless: true, notes: 'Japan is still very cash-based. Many restaurants and smaller shops are cash-only. IC cards (Suica) for transport.' },
      cultural: { dressCode: 'smart casual', notes: 'Remove shoes at homes, ryokans, many restaurants. Bow for greetings. Silence on public transport. Queueing is essential.' }
    },

    'MY': {
      timezone: 'Asia/Kuala_Lumpur',
      currency: 'MYR', currencySymbol: 'RM',
      language: 'Malay/English',
      emergency: '999',
      drivingSide: 'left',
      electricalPlug: 'G',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: 'RM 2–5/bag', notes: 'Service charge (10%) often added. Tip in cash where not included.' },
      water: { drinkable: false, notes: 'Tap water not recommended for drinking — use bottled water' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards in cities; Touch \'n Go e-wallet popular. Carry cash for markets and smaller eateries.' },
      cultural: { dressCode: 'modest — multi-religious country', notes: 'Multi-cultural (Malay, Chinese, Indian). Dress modestly especially at mosques. Right hand for eating. Remove shoes at homes.' }
    },

    'NZ': {
      timezone: 'Pacific/Auckland',
      currency: 'NZD', currencySymbol: 'NZ$',
      language: 'English',
      emergency: '111',
      drivingSide: 'left',
      electricalPlug: 'I',
      tipping: { culture: 'optional', restaurants: '0–10%', taxis: 'Not expected', hotels: 'Not expected', notes: 'Not culturally expected; staff earn good wages. Round up for outstanding service.' },
      water: { drinkable: true, notes: 'NZ tap water is safe throughout the country' },
      payment: { cashCulture: 'cashless', contactless: true, notes: 'Highly cashless society — contactless everywhere. EFTPOS dominant.' },
      cultural: { dressCode: 'casual', notes: 'Relaxed, outdoor culture. Māori culture is significant — treat it with respect. Very outdoors-oriented.' }
    },

    'PH': {
      timezone: 'Asia/Manila',
      currency: 'PHP', currencySymbol: '₱',
      language: 'Filipino/English',
      emergency: '117',
      drivingSide: 'right',
      electricalPlug: 'A/B/C',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '₱50/bag', notes: 'Service charge sometimes included; otherwise tip in cash. Very tip-appreciative culture.' },
      water: { drinkable: false, notes: 'Do not drink tap water in the Philippines — use bottled or purified water' },
      payment: { cashCulture: 'cash-heavy', contactless: true, notes: 'Cash still dominant; GCash and Maya e-wallets growing rapidly. ATMs available in cities.' },
      cultural: { dressCode: 'modest at churches', notes: 'Warm and hospitable culture (bayanihan). Strong Catholic influence. English widely spoken. "Filipino time" — punctuality relaxed socially.' }
    },

    'SG': {
      timezone: 'Asia/Singapore',
      currency: 'SGD', currencySymbol: 'S$',
      language: 'English/Mandarin/Malay/Tamil',
      emergency: '999',
      drivingSide: 'left',
      electricalPlug: 'G',
      tipping: { culture: 'not expected', restaurants: '10% service charge added', taxis: 'Not expected', hotels: 'Not expected', notes: '10% service charge mandatory in restaurants. Additional tip not expected or necessary.' },
      water: { drinkable: true, notes: 'Singapore tap water is world-class and completely safe' },
      payment: { cashCulture: 'cashless', contactless: true, notes: 'PayNow, NETS, cards all widely accepted. One of Asia\'s most cashless cities.' },
      cultural: { dressCode: 'smart casual', notes: 'Fine city — literally. Fines for littering, chewing gum, jaywalking. Efficient and orderly. Multi-cultural and tolerant.' }
    },

    'KR': {
      timezone: 'Asia/Seoul',
      currency: 'KRW', currencySymbol: '₩',
      language: 'Korean',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'not expected', restaurants: 'Not customary', taxis: 'Not expected', hotels: 'Not expected', notes: 'Tipping is not part of Korean culture and can cause awkwardness' },
      water: { drinkable: true, notes: 'Korean tap water is safe but locals tend to drink filtered or bottled water' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Korea is highly card-friendly. T-Money card for transport. KakaoPay popular.' },
      cultural: { dressCode: 'smart casual', notes: 'Confucian hierarchy — respect elders. Two hands when giving/receiving. Pali pali (빨리빨리) — fast-paced culture.' }
    },

    'TW': {
      timezone: 'Asia/Taipei',
      currency: 'TWD', currencySymbol: 'NT$',
      language: 'Mandarin',
      emergency: '110',
      drivingSide: 'right',
      electricalPlug: 'A/B',
      tipping: { culture: 'not expected', restaurants: 'Not customary', taxis: 'Not expected', hotels: 'Not expected', notes: 'Tipping is not common in Taiwan. Service charge may be included in upscale restaurants.' },
      water: { drinkable: false, notes: 'Tap water technically treated but locals drink filtered or boiled water. Use bottled to be safe.' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'EasyCard for transport. Cards widely accepted in cities; cash useful for night markets.' },
      cultural: { dressCode: 'smart casual', notes: 'Polite and welcoming. Night market culture is central. Traditional values with modern outlook.' }
    },

    'TH': {
      timezone: 'Asia/Bangkok',
      currency: 'THB', currencySymbol: '฿',
      language: 'Thai',
      emergency: '191',
      drivingSide: 'left',
      electricalPlug: 'A/B/C',
      tipping: { culture: 'appreciated', restaurants: '20–50 THB', taxis: 'Round up', hotels: '20–50 THB/bag', notes: 'Not obligatory but genuinely appreciated. Leave cash on table. Massage tips especially important.' },
      water: { drinkable: false, notes: 'Never drink tap water in Thailand — use bottled water for drinking and brushing teeth' },
      payment: { cashCulture: 'cash-heavy', contactless: true, notes: 'Cash (Baht) essential especially for street food, tuk-tuks, markets. Cards in malls and hotels.' },
      cultural: { dressCode: 'cover up at temples', notes: 'Never touch anyone\'s head. Feet are lowest — don\'t point with feet. Royal family must be treated with utmost respect (law). Remove shoes at temples.' }
    },

    'VN': {
      timezone: 'Asia/Ho_Chi_Minh',
      currency: 'VND', currencySymbol: '₫',
      language: 'Vietnamese',
      emergency: '113',
      drivingSide: 'right',
      electricalPlug: 'A/C/G',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '20,000–50,000 VND/bag', notes: 'Not traditional but increasingly expected in tourist areas. Always tip tour guides and drivers.' },
      water: { drinkable: false, notes: 'Never drink tap water in Vietnam — use bottled water only, including for brushing teeth' },
      payment: { cashCulture: 'cash-heavy', contactless: false, notes: 'Cash (Dong) preferred especially for street food and markets. Cards in hotels and larger restaurants. ATMs available.' },
      cultural: { dressCode: 'modest at temples', notes: 'Traffic is intense — cross roads slowly and steadily. Bargaining expected in markets. Remove shoes at some homes and temples.' }
    },

    // ===== MIDDLE EAST & AFRICA =====

    'EG': {
      timezone: 'Africa/Cairo',
      currency: 'EGP', currencySymbol: '£',
      language: 'Arabic',
      emergency: '122',
      drivingSide: 'right',
      electricalPlug: 'C/F',
      tipping: { culture: 'expected', restaurants: '10–15%', taxis: 'Round up', hotels: 'EGP 20–50/bag', notes: 'Baksheesh (tips) expected for almost any service. Carry small notes. Negotiate taxi prices upfront.' },
      water: { drinkable: false, notes: 'Do not drink tap water in Egypt — use sealed bottled water for everything' },
      payment: { cashCulture: 'cash-heavy', contactless: false, notes: 'Cash is king. ATMs available in cities. US dollars and euros sometimes accepted in tourist areas.' },
      cultural: { dressCode: 'modest — shoulders and knees covered', notes: 'Predominantly Muslim country. Women should dress conservatively. Remove shoes at mosques. Right hand for eating. Avoid photography of people without permission.' }
    },

    'IL': {
      timezone: 'Asia/Jerusalem',
      currency: 'ILS', currencySymbol: '₪',
      language: 'Hebrew/Arabic',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'C/H/M',
      tipping: { culture: 'expected', restaurants: '10–15%', taxis: 'Round up', hotels: '₪5–10/bag', notes: 'Service not usually included — tip in cash after meal' },
      water: { drinkable: true, notes: 'Israeli tap water is safe and good quality throughout the country' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards widely accepted; Bit and PayBox apps popular for local payments' },
      cultural: { dressCode: 'modest at religious sites', notes: 'Cover up at religious sites (Western Wall, churches, mosques). Shabbat (Friday sunset to Saturday night) affects many services.' }
    },

    'JO': {
      timezone: 'Asia/Amman',
      currency: 'JOD', currencySymbol: 'د.ا',
      language: 'Arabic',
      emergency: '911',
      drivingSide: 'right',
      electricalPlug: 'B/C/D/F/G/J',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: 'JOD 1–2/bag', notes: 'Service not included — tip in cash. Negotiate taxi fares before journey.' },
      water: { drinkable: false, notes: 'Tap water safe in Amman but use bottled to be safe; avoid tap water outside the capital' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards in Amman and tourist areas; carry cash (Jordanian Dinar) elsewhere' },
      cultural: { dressCode: 'modest — cover shoulders and knees', notes: 'Warm, hospitable culture. Accept tea/coffee when offered — refusing can be rude. Remove shoes at mosques. Avoid public displays of affection.' }
    },

    'KE': {
      timezone: 'Africa/Nairobi',
      currency: 'KES', currencySymbol: 'Sh',
      language: 'Swahili/English',
      emergency: '999',
      drivingSide: 'left',
      electricalPlug: 'G',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: 'KES 100–200/bag', notes: 'Not obligatory but meaningful given local wages. Always tip safari guides well.' },
      water: { drinkable: false, notes: 'Do not drink tap water in Kenya — use bottled or filtered water only' },
      payment: { cashCulture: 'mixed', contactless: false, notes: 'M-Pesa mobile money is dominant in Kenya. Cards in Nairobi hotels/malls; cash elsewhere.' },
      cultural: { dressCode: 'smart casual', notes: 'Kenyans are friendly and English-speaking. Greet before transacting. Handshakes with right hand.' }
    },

    'MA': {
      timezone: 'Africa/Casablanca',
      currency: 'MAD', currencySymbol: 'د.م.',
      language: 'Arabic/French',
      emergency: '15',
      drivingSide: 'right',
      electricalPlug: 'C/E',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '10–20 MAD/bag', notes: 'Tip tour guides, drivers, and porters. Bargaining expected in souks.' },
      water: { drinkable: false, notes: 'Do not drink tap water in Morocco — use sealed bottled water only' },
      payment: { cashCulture: 'cash-heavy', contactless: false, notes: 'Cash (Dirham) essential — most places cash only. Cards in riads and larger restaurants in cities.' },
      cultural: { dressCode: 'modest — shoulders and knees covered', notes: 'Predominantly Muslim. Women especially should dress conservatively. Ramadan significantly affects services. Remove shoes at mosques.' }
    },

    'ZA': {
      timezone: 'Africa/Johannesburg',
      currency: 'ZAR', currencySymbol: 'R',
      language: 'English/Afrikaans',
      emergency: '10111',
      drivingSide: 'left',
      electricalPlug: 'C/D/M/N',
      tipping: { culture: 'expected', restaurants: '10–15%', taxis: 'Round up', hotels: 'R5–10/bag', notes: 'Tipping is important — service workers depend on it. Always tip car guards (parking attendants).' },
      water: { drinkable: true, notes: 'Tap water safe in major cities; use bottled in rural areas or after flooding' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Cards in cities and tourist areas; carry Rand for markets, rural areas, and car guards' },
      cultural: { dressCode: 'smart casual', notes: 'Ubuntu philosophy — community and humanity. 11 official languages. Safety awareness important especially in cities.' }
    },

    'AE': {
      timezone: 'Asia/Dubai',
      currency: 'AED', currencySymbol: 'د.إ',
      language: 'Arabic/English',
      emergency: '999',
      drivingSide: 'right',
      electricalPlug: 'C/D/G',
      tipping: { culture: 'appreciated', restaurants: '10–15%', taxis: 'Round up', hotels: 'AED 5–10/bag', notes: 'Not mandatory but appreciated. Service charge sometimes added. Tip in cash.' },
      water: { drinkable: true, notes: 'Tap water is technically safe but most residents and visitors drink bottled water' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Very card and contactless friendly. Apple/Google Pay widely accepted in UAE.' },
      cultural: { dressCode: 'modest in public — smart elsewhere', notes: 'Cover up in malls, markets, mosques. Alcohol only in licensed venues. Public displays of affection illegal. During Ramadan, eating/drinking in public during daylight is illegal.' }
    },

    // ===== SOUTH AMERICA =====

    'AR': {
      timezone: 'America/Buenos_Aires',
      currency: 'ARS', currencySymbol: '$',
      language: 'Spanish',
      emergency: '911',
      drivingSide: 'right',
      electricalPlug: 'C/I',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '100–200 ARS/bag', notes: 'Leave cash tip directly. Blue rate (informal exchange) exists — exchange officially only.' },
      water: { drinkable: true, notes: 'Buenos Aires tap water is safe; use bottled in rural areas' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Argentina has complex currency — carry USD cash for best exchange rates. Cards accepted widely.' },
      cultural: { dressCode: 'smart casual', notes: 'Porteños (Buenos Aires locals) are fashionable and social. Late dining culture — dinner from 9pm. Mate tea culture is important.' }
    },

    'BR': {
      timezone: 'America/Sao_Paulo',
      currency: 'BRL', currencySymbol: 'R$',
      language: 'Portuguese',
      emergency: '190',
      drivingSide: 'right',
      electricalPlug: 'C/N',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: 'R$5–10/bag', notes: '10% service charge (taxa de serviço) often on bill. Tip additionally for good service.' },
      water: { drinkable: false, notes: 'Tap water technically safe in major cities but use bottled to be safe' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Pix instant payment is hugely popular in Brazil. Cards widely accepted. Keep Reais for smaller vendors.' },
      cultural: { dressCode: 'casual to beach-smart', notes: 'Warm and expressive culture. Brazilians greet with kisses on cheek. Flexible punctuality socially. Safety awareness important in cities.' }
    },

    'CL': {
      timezone: 'America/Santiago',
      currency: 'CLP', currencySymbol: '$',
      language: 'Spanish',
      emergency: '133',
      drivingSide: 'right',
      electricalPlug: 'C/L',
      tipping: { culture: 'expected', restaurants: '10%', taxis: 'Round up', hotels: '1,000–2,000 CLP/bag', notes: '10% propina (tip) standard in restaurants. Leave in cash directly with server.' },
      water: { drinkable: true, notes: 'Chilean tap water is safe in Santiago and most cities; use bottled in north (Atacama region)' },
      payment: { cashCulture: 'card-friendly', contactless: true, notes: 'Cards widely accepted; contactless common. Chilean Peso — ATMs readily available.' },
      cultural: { dressCode: 'smart casual', notes: 'Chileans are formal and reserved compared to other Latin Americans. Punctuality more respected than in neighbouring countries.' }
    },

    'CO': {
      timezone: 'America/Bogota',
      currency: 'COP', currencySymbol: '$',
      language: 'Spanish',
      emergency: '123',
      drivingSide: 'right',
      electricalPlug: 'A/B',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Round up', hotels: '2,000–5,000 COP/bag', notes: 'Propina (tip) not always expected but appreciated. Carry small notes.' },
      water: { drinkable: true, notes: 'Tap water safe in Bogotá and major cities; use bottled elsewhere' },
      payment: { cashCulture: 'mixed', contactless: true, notes: 'Nequi and Daviplata apps popular. Cards in cities; carry cash outside major centres.' },
      cultural: { dressCode: 'smart casual', notes: 'Colombians are warm and hospitable. Bogotá is formal; coast is relaxed. Safety awareness important in some areas.' }
    },

    'PE': {
      timezone: 'America/Lima',
      currency: 'PEN', currencySymbol: 'S/',
      language: 'Spanish',
      emergency: '105',
      drivingSide: 'right',
      electricalPlug: 'A/B/C',
      tipping: { culture: 'appreciated', restaurants: '10%', taxis: 'Agree price upfront', hotels: 'S/2–5/bag', notes: 'Service charge sometimes included. Always agree taxi price before journey. Tour guides expect tips.' },
      water: { drinkable: false, notes: 'Do not drink tap water in Peru — use bottled or purified water only' },
      payment: { cashCulture: 'mixed', contactless: false, notes: 'Carry soles (PEN) especially outside Lima. Cards in tourist areas and upscale restaurants.' },
      cultural: { dressCode: 'smart casual', notes: 'Peruvians are friendly and proud of their heritage. Altitude sickness real in Cusco/Machu Picchu — acclimatise before exerting.' }
    }

  },

  // Helper functions
  getCountryByCode(code) {
    return this.dropdownList.find(country => country.code === code);
  },

  getCountryMetadata(code) {
    return this.countryMetadata[code] || {
      timezone: 'UTC',
      currency: 'USD',
      currencySymbol: '$',
      language: 'Local Language',
      emergency: '112',
      drivingSide: 'right',
      electricalPlug: 'Unknown',
      tipping: { culture: 'unknown', restaurants: 'Unknown', taxis: 'Unknown', hotels: 'Unknown', notes: 'Check locally' },
      water: { drinkable: false, notes: 'Check local guidance before drinking tap water' },
      payment: { cashCulture: 'mixed', contactless: false, notes: 'Carry local currency as backup' },
      cultural: { dressCode: 'smart casual', notes: 'Research local customs before travelling' }
    };
  },

  getCountriesByRegion(region) {
    return this.dropdownList.filter(country => country.region === region);
  },

  getDropdownOptions() {
    return this.dropdownList.map(country => ({
      value: country.code,
      label: country.name,
      region: country.region
    }));
  },

  getGroupedDropdownOptions() {
    const grouped = {};
    this.dropdownList.forEach(country => {
      if (!grouped[country.region]) {
        grouped[country.region] = [];
      }
      grouped[country.region].push({
        value: country.code,
        label: country.name
      });
    });
    return grouped;
  }
};