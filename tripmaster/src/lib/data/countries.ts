export interface CountryMeta {
  timezone: string;
  currency: string;
  currencySymbol: string;
  language: string;
  emergency: string;
  drivingSide: 'left' | 'right';
  electricalPlug: string;
}

export interface Country {
  code: string;
  name: string;
  region: string;
}

export const COUNTRY_LIST: Country[] = [
  // Europe
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
  // Asia Pacific
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
  // Middle East & Africa
  { code: 'EG', name: 'Egypt', region: 'Middle East & Africa' },
  { code: 'IL', name: 'Israel', region: 'Middle East & Africa' },
  { code: 'JO', name: 'Jordan', region: 'Middle East & Africa' },
  { code: 'KE', name: 'Kenya', region: 'Middle East & Africa' },
  { code: 'MA', name: 'Morocco', region: 'Middle East & Africa' },
  { code: 'ZA', name: 'South Africa', region: 'Middle East & Africa' },
  { code: 'AE', name: 'United Arab Emirates', region: 'Middle East & Africa' },
  // South America
  { code: 'AR', name: 'Argentina', region: 'South America' },
  { code: 'BR', name: 'Brazil', region: 'South America' },
  { code: 'CL', name: 'Chile', region: 'South America' },
  { code: 'CO', name: 'Colombia', region: 'South America' },
  { code: 'PE', name: 'Peru', region: 'South America' },
];

export const COUNTRY_META: Record<string, CountryMeta> = {
  'AT': { timezone: 'Europe/Vienna', currency: 'EUR', currencySymbol: '€', language: 'German', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'BE': { timezone: 'Europe/Brussels', currency: 'EUR', currencySymbol: '€', language: 'French/Dutch/German', emergency: '112', drivingSide: 'right', electricalPlug: 'C/E' },
  'BG': { timezone: 'Europe/Sofia', currency: 'BGN', currencySymbol: 'лв', language: 'Bulgarian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'HR': { timezone: 'Europe/Zagreb', currency: 'EUR', currencySymbol: '€', language: 'Croatian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'CZ': { timezone: 'Europe/Prague', currency: 'CZK', currencySymbol: 'Kč', language: 'Czech', emergency: '112', drivingSide: 'right', electricalPlug: 'C/E' },
  'DK': { timezone: 'Europe/Copenhagen', currency: 'DKK', currencySymbol: 'kr', language: 'Danish', emergency: '112', drivingSide: 'right', electricalPlug: 'C/E/F/K' },
  'EE': { timezone: 'Europe/Tallinn', currency: 'EUR', currencySymbol: '€', language: 'Estonian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'FI': { timezone: 'Europe/Helsinki', currency: 'EUR', currencySymbol: '€', language: 'Finnish/Swedish', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'FR': { timezone: 'Europe/Paris', currency: 'EUR', currencySymbol: '€', language: 'French', emergency: '112', drivingSide: 'right', electricalPlug: 'C/E' },
  'DE': { timezone: 'Europe/Berlin', currency: 'EUR', currencySymbol: '€', language: 'German', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'GR': { timezone: 'Europe/Athens', currency: 'EUR', currencySymbol: '€', language: 'Greek', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'HU': { timezone: 'Europe/Budapest', currency: 'HUF', currencySymbol: 'Ft', language: 'Hungarian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'IS': { timezone: 'Atlantic/Reykjavik', currency: 'ISK', currencySymbol: 'kr', language: 'Icelandic', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'IE': { timezone: 'Europe/Dublin', currency: 'EUR', currencySymbol: '€', language: 'English/Irish', emergency: '999', drivingSide: 'left', electricalPlug: 'G' },
  'IT': { timezone: 'Europe/Rome', currency: 'EUR', currencySymbol: '€', language: 'Italian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F/L' },
  'LV': { timezone: 'Europe/Riga', currency: 'EUR', currencySymbol: '€', language: 'Latvian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'LT': { timezone: 'Europe/Vilnius', currency: 'EUR', currencySymbol: '€', language: 'Lithuanian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'LU': { timezone: 'Europe/Luxembourg', currency: 'EUR', currencySymbol: '€', language: 'French/German/Luxembourgish', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'MT': { timezone: 'Europe/Malta', currency: 'EUR', currencySymbol: '€', language: 'Maltese/English', emergency: '112', drivingSide: 'left', electricalPlug: 'G' },
  'NL': { timezone: 'Europe/Amsterdam', currency: 'EUR', currencySymbol: '€', language: 'Dutch', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'NO': { timezone: 'Europe/Oslo', currency: 'NOK', currencySymbol: 'kr', language: 'Norwegian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'PL': { timezone: 'Europe/Warsaw', currency: 'PLN', currencySymbol: 'zł', language: 'Polish', emergency: '112', drivingSide: 'right', electricalPlug: 'C/E' },
  'PT': { timezone: 'Europe/Lisbon', currency: 'EUR', currencySymbol: '€', language: 'Portuguese', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'RO': { timezone: 'Europe/Bucharest', currency: 'RON', currencySymbol: 'lei', language: 'Romanian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'SK': { timezone: 'Europe/Bratislava', currency: 'EUR', currencySymbol: '€', language: 'Slovak', emergency: '112', drivingSide: 'right', electricalPlug: 'C/E' },
  'SI': { timezone: 'Europe/Ljubljana', currency: 'EUR', currencySymbol: '€', language: 'Slovenian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'ES': { timezone: 'Europe/Madrid', currency: 'EUR', currencySymbol: '€', language: 'Spanish', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'SE': { timezone: 'Europe/Stockholm', currency: 'SEK', currencySymbol: 'kr', language: 'Swedish', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'CH': { timezone: 'Europe/Zurich', currency: 'CHF', currencySymbol: 'Fr', language: 'German/French/Italian', emergency: '112', drivingSide: 'right', electricalPlug: 'C/J' },
  'GB': { timezone: 'Europe/London', currency: 'GBP', currencySymbol: '£', language: 'English', emergency: '999', drivingSide: 'left', electricalPlug: 'G' },
  'CA': { timezone: 'America/Toronto', currency: 'CAD', currencySymbol: 'C$', language: 'English/French', emergency: '911', drivingSide: 'right', electricalPlug: 'A/B' },
  'MX': { timezone: 'America/Mexico_City', currency: 'MXN', currencySymbol: '$', language: 'Spanish', emergency: '911', drivingSide: 'right', electricalPlug: 'A/B' },
  'US': { timezone: 'America/New_York', currency: 'USD', currencySymbol: '$', language: 'English', emergency: '911', drivingSide: 'right', electricalPlug: 'A/B' },
  'AU': { timezone: 'Australia/Sydney', currency: 'AUD', currencySymbol: 'A$', language: 'English', emergency: '000', drivingSide: 'left', electricalPlug: 'I' },
  'CN': { timezone: 'Asia/Shanghai', currency: 'CNY', currencySymbol: '¥', language: 'Mandarin', emergency: '110', drivingSide: 'right', electricalPlug: 'A/C/I' },
  'HK': { timezone: 'Asia/Hong_Kong', currency: 'HKD', currencySymbol: 'HK$', language: 'Cantonese/English', emergency: '999', drivingSide: 'left', electricalPlug: 'G' },
  'IN': { timezone: 'Asia/Kolkata', currency: 'INR', currencySymbol: '₹', language: 'Hindi/English', emergency: '112', drivingSide: 'left', electricalPlug: 'C/D/M' },
  'ID': { timezone: 'Asia/Jakarta', currency: 'IDR', currencySymbol: 'Rp', language: 'Indonesian', emergency: '112', drivingSide: 'left', electricalPlug: 'C/F' },
  'JP': { timezone: 'Asia/Tokyo', currency: 'JPY', currencySymbol: '¥', language: 'Japanese', emergency: '119', drivingSide: 'left', electricalPlug: 'A/B' },
  'MY': { timezone: 'Asia/Kuala_Lumpur', currency: 'MYR', currencySymbol: 'RM', language: 'Malay/English', emergency: '999', drivingSide: 'left', electricalPlug: 'G' },
  'NZ': { timezone: 'Pacific/Auckland', currency: 'NZD', currencySymbol: 'NZ$', language: 'English', emergency: '111', drivingSide: 'left', electricalPlug: 'I' },
  'PH': { timezone: 'Asia/Manila', currency: 'PHP', currencySymbol: '₱', language: 'Filipino/English', emergency: '911', drivingSide: 'right', electricalPlug: 'A/B/C' },
  'SG': { timezone: 'Asia/Singapore', currency: 'SGD', currencySymbol: 'S$', language: 'English/Mandarin/Malay/Tamil', emergency: '999', drivingSide: 'left', electricalPlug: 'G' },
  'KR': { timezone: 'Asia/Seoul', currency: 'KRW', currencySymbol: '₩', language: 'Korean', emergency: '112', drivingSide: 'right', electricalPlug: 'C/F' },
  'TW': { timezone: 'Asia/Taipei', currency: 'TWD', currencySymbol: 'NT$', language: 'Mandarin', emergency: '110', drivingSide: 'right', electricalPlug: 'A/B' },
  'TH': { timezone: 'Asia/Bangkok', currency: 'THB', currencySymbol: '฿', language: 'Thai', emergency: '191', drivingSide: 'left', electricalPlug: 'A/B/C' },
  'VN': { timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', currencySymbol: '₫', language: 'Vietnamese', emergency: '113', drivingSide: 'right', electricalPlug: 'A/C/G' },
  'EG': { timezone: 'Africa/Cairo', currency: 'EGP', currencySymbol: '£', language: 'Arabic', emergency: '122', drivingSide: 'right', electricalPlug: 'C/F' },
  'IL': { timezone: 'Asia/Jerusalem', currency: 'ILS', currencySymbol: '₪', language: 'Hebrew/Arabic', emergency: '112', drivingSide: 'right', electricalPlug: 'C/H/M' },
  'JO': { timezone: 'Asia/Amman', currency: 'JOD', currencySymbol: 'د.ا', language: 'Arabic', emergency: '911', drivingSide: 'right', electricalPlug: 'B/C/D/F/G/J' },
  'KE': { timezone: 'Africa/Nairobi', currency: 'KES', currencySymbol: 'Sh', language: 'Swahili/English', emergency: '999', drivingSide: 'left', electricalPlug: 'G' },
  'MA': { timezone: 'Africa/Casablanca', currency: 'MAD', currencySymbol: 'د.م.', language: 'Arabic/French', emergency: '15', drivingSide: 'right', electricalPlug: 'C/E' },
  'ZA': { timezone: 'Africa/Johannesburg', currency: 'ZAR', currencySymbol: 'R', language: 'English/Afrikaans', emergency: '10111', drivingSide: 'left', electricalPlug: 'C/D/M/N' },
  'AE': { timezone: 'Asia/Dubai', currency: 'AED', currencySymbol: 'د.إ', language: 'Arabic/English', emergency: '999', drivingSide: 'right', electricalPlug: 'C/D/G' },
  'AR': { timezone: 'America/Buenos_Aires', currency: 'ARS', currencySymbol: '$', language: 'Spanish', emergency: '911', drivingSide: 'right', electricalPlug: 'C/I' },
  'BR': { timezone: 'America/Sao_Paulo', currency: 'BRL', currencySymbol: 'R$', language: 'Portuguese', emergency: '190', drivingSide: 'right', electricalPlug: 'C/N' },
  'CL': { timezone: 'America/Santiago', currency: 'CLP', currencySymbol: '$', language: 'Spanish', emergency: '133', drivingSide: 'right', electricalPlug: 'C/L' },
  'CO': { timezone: 'America/Bogota', currency: 'COP', currencySymbol: '$', language: 'Spanish', emergency: '123', drivingSide: 'right', electricalPlug: 'A/B' },
  'PE': { timezone: 'America/Lima', currency: 'PEN', currencySymbol: 'S/', language: 'Spanish', emergency: '105', drivingSide: 'right', electricalPlug: 'A/B/C' },
};

export function getCountryMeta(code: string): CountryMeta {
  return COUNTRY_META[code] ?? {
    timezone: 'UTC',
    currency: 'USD',
    currencySymbol: '$',
    language: 'Unknown',
    emergency: '112',
    drivingSide: 'right',
    electricalPlug: 'Unknown',
  };
}

export function getCountryName(code: string): string {
  return COUNTRY_LIST.find(c => c.code === code)?.name ?? code;
}

export const COUNTRY_OPTIONS = COUNTRY_LIST.map(c => ({
  value: c.code,
  label: c.name,
  region: c.region,
}));