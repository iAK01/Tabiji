export interface Phrase {
  id: string;
  english: string;
  local: string;
  phonetic: string;
  usage: string;
  context: string;
}

export interface CountryPhrases {
  language: string;
  localName: string;
  phrases: Phrase[];
}

export const LANGUAGE_PHRASES: Record<string, CountryPhrases> = {
  'FR': {
    language: 'French', localName: 'Français',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Bonjour', phonetic: 'bon-ZHOOR', usage: 'formal greeting', context: 'Always greet shopkeepers when entering' },
      { id: 'thank_you', english: 'Thank you', local: 'Merci', phonetic: 'mer-SEE', usage: 'essential politeness', context: 'Always say this' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Excusez-moi', phonetic: 'ex-koo-zay-MWAH', usage: 'getting attention', context: 'Very important in French culture' },
      { id: 'speak_english', english: 'Do you speak English?', local: 'Parlez-vous anglais?', phonetic: 'par-lay voo ahn-GLAY', usage: 'communication starter', context: 'Most appreciate the effort' },
      { id: 'how_much', english: 'How much?', local: 'Combien?', phonetic: 'kom-bee-AHN', usage: 'shopping', context: 'Point to item' },
      { id: 'where_is', english: 'Where is...?', local: 'Où est...?', phonetic: 'oo ay', usage: 'navigation', context: 'Follow with location' },
      { id: 'check_please', english: 'The check, please', local: "L'addition, s'il vous plaît", phonetic: 'lah-dee-see-OHN seel voo PLAY', usage: 'restaurants', context: 'Never rush in France' },
      { id: 'help', english: 'Help!', local: 'Au secours!', phonetic: 'oh suh-KOOR', usage: 'emergency', context: 'Urgent situations' },
      { id: 'please', english: 'Please', local: "S'il vous plaît", phonetic: 'seel voo PLAY', usage: 'politeness', context: 'Essential for requests' },
    ],
  },
  'DE': {
    language: 'German', localName: 'Deutsch',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Hallo', phonetic: 'HAH-lo', usage: 'casual greeting', context: 'Universal greeting' },
      { id: 'thank_you', english: 'Thank you', local: 'Danke', phonetic: 'DAHN-keh', usage: 'essential politeness', context: 'Always appreciated' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Entschuldigung', phonetic: 'ent-SHOOL-di-goong', usage: 'getting attention/sorry', context: 'Germans appreciate politeness' },
      { id: 'speak_english', english: 'Do you speak English?', local: 'Sprechen Sie Englisch?', phonetic: 'SHPREH-khen zee ENG-lish', usage: 'communication starter', context: 'Many Germans speak English well' },
      { id: 'how_much', english: 'How much?', local: 'Wie viel kostet das?', phonetic: 'vee feel KOS-tet dahs', usage: 'shopping', context: 'Point to item' },
      { id: 'where_is', english: 'Where is...?', local: 'Wo ist...?', phonetic: 'voh ist', usage: 'navigation', context: 'Germans are helpful with directions' },
      { id: 'check_please', english: 'The check, please', local: 'Die Rechnung, bitte', phonetic: 'dee REKH-noong BIT-teh', usage: 'restaurants', context: 'Make eye contact with server' },
      { id: 'help', english: 'Help!', local: 'Hilfe!', phonetic: 'HIL-feh', usage: 'emergency', context: 'Emergency situations' },
      { id: 'please', english: 'Please', local: 'Bitte', phonetic: 'BIT-teh', usage: 'politeness', context: 'Also means "you\'re welcome"' },
    ],
  },
  'ES': {
    language: 'Spanish', localName: 'Español',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Hola', phonetic: 'OH-lah', usage: 'universal greeting', context: 'Works any time of day' },
      { id: 'thank_you', english: 'Thank you', local: 'Gracias', phonetic: 'GRAH-see-ahs', usage: 'essential politeness', context: 'Always appreciated' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Perdón', phonetic: 'per-DOHN', usage: 'getting attention/sorry', context: 'Use to get past people' },
      { id: 'speak_english', english: 'Do you speak English?', local: '¿Habla inglés?', phonetic: 'AH-blah in-GLAYS', usage: 'communication starter', context: 'Spanish appreciate the effort' },
      { id: 'how_much', english: 'How much?', local: '¿Cuánto cuesta?', phonetic: 'KWAN-toh KWES-tah', usage: 'shopping', context: 'Essential for markets' },
      { id: 'where_is', english: 'Where is...?', local: '¿Dónde está...?', phonetic: 'DOHN-deh es-TAH', usage: 'navigation', context: 'Spanish are very helpful' },
      { id: 'check_please', english: 'The check, please', local: 'La cuenta, por favor', phonetic: 'lah KWEN-tah por fah-VOR', usage: 'restaurants', context: 'Signal to waiter' },
      { id: 'help', english: 'Help!', local: '¡Ayuda!', phonetic: 'ah-YOO-dah', usage: 'emergency', context: 'Emergency situations' },
      { id: 'please', english: 'Please', local: 'Por favor', phonetic: 'por fah-VOR', usage: 'politeness', context: 'Essential for requests' },
    ],
  },
  'IT': {
    language: 'Italian', localName: 'Italiano',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Ciao', phonetic: 'chow', usage: 'casual greeting', context: 'Universal, casual greeting' },
      { id: 'thank_you', english: 'Thank you', local: 'Grazie', phonetic: 'GRAH-tsee-ay', usage: 'essential politeness', context: 'Italians love politeness' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Scusi', phonetic: 'SKOO-zee', usage: 'getting attention/sorry', context: 'Very important in Italy' },
      { id: 'speak_english', english: 'Do you speak English?', local: 'Parla inglese?', phonetic: 'PAR-lah in-GLAY-zay', usage: 'communication starter', context: 'Italians appreciate effort' },
      { id: 'how_much', english: 'How much?', local: 'Quanto costa?', phonetic: 'KWAN-toh KOS-tah', usage: 'shopping', context: 'Essential for shopping' },
      { id: 'where_is', english: 'Where is...?', local: 'Dove si trova...?', phonetic: 'DOH-veh see TROH-vah', usage: 'navigation', context: 'Italians give animated directions' },
      { id: 'check_please', english: 'The check, please', local: 'Il conto, per favore', phonetic: 'eel KON-toh per fah-VOH-ray', usage: 'restaurants', context: 'You must ask for the check' },
      { id: 'help', english: 'Help!', local: 'Aiuto!', phonetic: 'ah-YOO-toh', usage: 'emergency', context: 'Emergency situations' },
      { id: 'please', english: 'Please', local: 'Per favore', phonetic: 'per fah-VOH-ray', usage: 'politeness', context: 'Essential for requests' },
    ],
  },
  'PT': {
    language: 'Portuguese', localName: 'Português',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Olá', phonetic: 'oh-LAH', usage: 'universal greeting', context: 'Friendly greeting' },
      { id: 'thank_you', english: 'Thank you', local: 'Obrigado/Obrigada', phonetic: 'oh-bree-GAH-doo/dah', usage: 'essential politeness', context: 'Men say obrigado, women say obrigada' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Com licença', phonetic: 'kom lee-SEN-sah', usage: 'getting attention', context: 'Polite way to get attention' },
      { id: 'speak_english', english: 'Do you speak English?', local: 'Fala inglês?', phonetic: 'FAH-lah in-GLAYS', usage: 'communication starter', context: 'Portuguese are helpful' },
      { id: 'how_much', english: 'How much?', local: 'Quanto custa?', phonetic: 'KWAN-too KOOS-tah', usage: 'shopping', context: 'Essential for shopping' },
      { id: 'where_is', english: 'Where is...?', local: 'Onde fica...?', phonetic: 'ON-deh FEE-kah', usage: 'navigation', context: 'For locations' },
      { id: 'check_please', english: 'The check, please', local: 'A conta, por favor', phonetic: 'ah KON-tah por fah-VOR', usage: 'restaurants', context: 'Signal to waiter' },
      { id: 'help', english: 'Help!', local: 'Socorro!', phonetic: 'so-KOR-roo', usage: 'emergency', context: 'Emergency situations' },
      { id: 'please', english: 'Please', local: 'Por favor', phonetic: 'por fah-VOR', usage: 'politeness', context: 'Essential for requests' },
    ],
  },
  'GR': {
    language: 'Greek', localName: 'Ελληνικά',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Γεια σας', phonetic: 'YAH-sas', usage: 'formal greeting', context: 'Use in shops, restaurants, with strangers' },
      { id: 'thank_you', english: 'Thank you', local: 'Ευχαριστώ', phonetic: 'ef-kha-ri-STO', usage: 'essential politeness', context: 'Always appreciated' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Συγγνώμη', phonetic: 'see-GHNO-mee', usage: 'getting attention/apologizing', context: 'To get past someone or get attention' },
      { id: 'speak_english', english: 'Do you speak English?', local: 'Μιλάτε αγγλικά;', phonetic: 'mi-LA-te ang-gli-KA', usage: 'communication starter', context: 'First thing to ask in any interaction' },
      { id: 'how_much', english: 'How much?', local: 'Πόσο κοστίζει;', phonetic: 'PO-so ko-STI-zi', usage: 'shopping/restaurants', context: 'Point to item and ask' },
      { id: 'where_is', english: 'Where is...?', local: 'Πού είναι...;', phonetic: 'POO EE-ne', usage: 'navigation', context: 'Follow with place name' },
      { id: 'check_please', english: 'The check, please', local: 'Τον λογαριασμό, παρακαλώ', phonetic: 'ton lo-gha-ri-a-SMO pa-ra-ka-LO', usage: 'restaurants', context: 'Make writing gesture' },
      { id: 'help', english: 'Help!', local: 'Βοήθεια!', phonetic: 'vo-EE-thi-a', usage: 'emergency', context: 'Urgent situations only' },
      { id: 'please', english: 'Please', local: 'Παρακαλώ', phonetic: 'pa-ra-ka-LO', usage: 'politeness', context: 'Use with requests' },
    ],
  },
  'JP': {
    language: 'Japanese', localName: '日本語',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'こんにちは', phonetic: 'kon-nee-chee-wah', usage: 'universal greeting', context: 'Safe greeting any time' },
      { id: 'thank_you', english: 'Thank you', local: 'ありがとうございます', phonetic: 'ah-ree-gah-toh goh-zah-ee-mahs', usage: 'formal thanks', context: 'Very important in Japanese culture' },
      { id: 'excuse_me', english: 'Excuse me', local: 'すみません', phonetic: 'soo-mee-mah-sen', usage: 'getting attention/sorry', context: 'Multi-purpose polite phrase' },
      { id: 'speak_english', english: 'Do you speak English?', local: '英語を話せますか？', phonetic: 'ay-go oh hah-nah-say-mahs kah', usage: 'communication starter', context: 'Japanese appreciate effort' },
      { id: 'how_much', english: 'How much?', local: 'いくらですか？', phonetic: 'ee-koo-rah des kah', usage: 'shopping', context: 'Point to item' },
      { id: 'where_is', english: 'Where is...?', local: '...はどこですか？', phonetic: '... wah doh-koh des kah', usage: 'navigation', context: 'Say location name first' },
      { id: 'check_please', english: 'The check, please', local: 'お会計をお願いします', phonetic: 'oh-kah-kay oh oh-neh-gah-ee shee-mahs', usage: 'restaurants', context: 'Make X gesture with fingers' },
      { id: 'help', english: 'Help!', local: '助けて！', phonetic: 'tah-soo-kay-tay', usage: 'emergency', context: 'Emergency situations' },
      { id: 'please', english: 'Please', local: 'お願いします', phonetic: 'oh-neh-gah-ee shee-mahs', usage: 'politeness', context: 'Essential for requests' },
    ],
  },
  'RO': {
    language: 'Romanian', localName: 'Română',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Bună ziua', phonetic: 'BOO-nuh ZEE-wah', usage: 'formal greeting', context: 'Standard daytime greeting' },
      { id: 'thank_you', english: 'Thank you', local: 'Mulțumesc', phonetic: 'mool-tsoo-MESK', usage: 'essential politeness', context: 'Always appreciated' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Scuzați-mă', phonetic: 'skoo-ZAH-tsee muh', usage: 'getting attention', context: 'Polite way to get attention' },
      { id: 'speak_english', english: 'Do you speak English?', local: 'Vorbiți engleză?', phonetic: 'vor-BEETS en-GLAY-zuh', usage: 'communication starter', context: 'Many younger Romanians speak English' },
      { id: 'how_much', english: 'How much?', local: 'Cât costă?', phonetic: 'kuht KOS-tuh', usage: 'shopping', context: 'Essential for markets' },
      { id: 'where_is', english: 'Where is...?', local: 'Unde este...?', phonetic: 'OON-deh YES-teh', usage: 'navigation', context: 'Follow with place name' },
      { id: 'check_please', english: 'The check, please', local: 'Nota de plată, vă rog', phonetic: 'NO-tah deh PLAH-tuh vuh rog', usage: 'restaurants', context: 'Signal to waiter' },
      { id: 'help', english: 'Help!', local: 'Ajutor!', phonetic: 'ah-zhoo-TOR', usage: 'emergency', context: 'Emergency situations' },
      { id: 'please', english: 'Please', local: 'Vă rog', phonetic: 'vuh rog', usage: 'politeness', context: 'Essential for requests' },
    ],
  },
  'NL': {
    language: 'Dutch', localName: 'Nederlands',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Hallo', phonetic: 'HAH-loh', usage: 'casual greeting', context: 'Most Dutch speak excellent English' },
      { id: 'thank_you', english: 'Thank you', local: 'Dank je wel', phonetic: 'dahnk yeh vel', usage: 'essential politeness', context: 'Always appreciated' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Pardon', phonetic: 'par-DON', usage: 'getting attention', context: 'Same as English-speakers' },
      { id: 'speak_english', english: 'Do you speak English?', local: 'Spreekt u Engels?', phonetic: 'spreykt oo ENG-els', usage: 'communication starter', context: 'Most will already speak English' },
      { id: 'how_much', english: 'How much?', local: 'Hoeveel kost het?', phonetic: 'HOO-veyl kost het', usage: 'shopping', context: 'For markets' },
      { id: 'where_is', english: 'Where is...?', local: 'Waar is...?', phonetic: 'vahr is', usage: 'navigation', context: 'Dutch are very helpful' },
      { id: 'check_please', english: 'The check, please', local: 'De rekening, alsjeblieft', phonetic: 'deh RAY-ken-ing ALS-yeh-bleeft', usage: 'restaurants', context: 'Signal to waiter' },
      { id: 'help', english: 'Help!', local: 'Help!', phonetic: 'help', usage: 'emergency', context: 'Same as English' },
      { id: 'please', english: 'Please', local: 'Alsjeblieft', phonetic: 'ALS-yeh-bleeft', usage: 'politeness', context: 'Essential for requests' },
    ],
  },
  'PL': {
    language: 'Polish', localName: 'Polski',
    phrases: [
      { id: 'hello', english: 'Hello', local: 'Dzień dobry', phonetic: 'jen DOB-rih', usage: 'formal greeting', context: 'Formal daytime greeting' },
      { id: 'thank_you', english: 'Thank you', local: 'Dziękuję', phonetic: 'jen-KOO-yeh', usage: 'essential politeness', context: 'Always appreciated' },
      { id: 'excuse_me', english: 'Excuse me', local: 'Przepraszam', phonetic: 'psheh-PRAH-shahm', usage: 'getting attention/sorry', context: 'Also used to apologise' },
      { id: 'speak_english', english: 'Do you speak English?', local: 'Czy mówi Pan/Pani po angielsku?', phonetic: 'chih MOO-vee pahn/PAH-nee poh ahn-GYEL-skoo', usage: 'communication starter', context: 'Many younger Poles speak English' },
      { id: 'how_much', english: 'How much?', local: 'Ile to kosztuje?', phonetic: 'EE-leh toh kosh-TOO-yeh', usage: 'shopping', context: 'Essential for markets' },
      { id: 'where_is', english: 'Where is...?', local: 'Gdzie jest...?', phonetic: 'gdjeh yest', usage: 'navigation', context: 'Follow with place name' },
      { id: 'check_please', english: 'The check, please', local: 'Rachunek, poproszę', phonetic: 'rah-KHOO-nek poh-PROH-sheh', usage: 'restaurants', context: 'Signal to waiter' },
      { id: 'help', english: 'Help!', local: 'Pomocy!', phonetic: 'poh-MOH-tsih', usage: 'emergency', context: 'Emergency situations' },
      { id: 'please', english: 'Please', local: 'Proszę', phonetic: 'PROH-sheh', usage: 'politeness', context: 'Essential for requests' },
    ],
  },
};

// Countries where English is primary/official — no phrases needed
export const ENGLISH_SPEAKING = new Set(['IE', 'GB', 'US', 'CA', 'AU', 'NZ', 'SG', 'HK', 'IN', 'MY', 'PH', 'ZA', 'KE', 'MT']);

// Map country codes to phrase language codes (where they differ)
const COUNTRY_TO_PHRASE_LANG: Record<string, string> = {
  'AT': 'DE', 'CH': 'DE',   // German-speaking countries → DE phrases
  'MX': 'ES', 'AR': 'ES', 'CO': 'ES', 'CL': 'ES', 'PE': 'ES',  // Spanish-speaking → ES
  'BR': 'PT',               // Brazil → PT phrases
  'TW': 'JP',               // Mandarin — use JP as closest available
  'CN': 'JP',               // Mandarin
};

export function getPhrasesForCountry(countryCode: string): CountryPhrases | null {
  if (ENGLISH_SPEAKING.has(countryCode)) return null;
  const langCode = COUNTRY_TO_PHRASE_LANG[countryCode] ?? countryCode;
  return LANGUAGE_PHRASES[langCode] ?? null;
}

export const ESSENTIAL_PHRASE_IDS = ['hello', 'thank_you', 'excuse_me', 'speak_english', 'how_much', 'where_is', 'help'];