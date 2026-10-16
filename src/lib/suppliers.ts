import type { Expense } from './types'

interface Known {
  name: string
  re: RegExp
  category: string
}

const SW = 'Software en abonnementen'
const REIS = 'Reiskosten en vervoer'
const TEL = 'Telefoon en internet'
const KLEIN = 'Kleine aanschaffen (< €450)'
const KANTOOR = 'Kantoorkosten'
const MARKETING = 'Marketing en reclame'
const OPL = 'Opleiding en vakliteratuur'
const VERZ = 'Verzekeringen'
const BANK = 'Bankkosten'
const HUUR = 'Huur (studio, apparatuur)'

/** Bekende leveranciers (NL + groot internationaal). Volgorde = prioriteit. */
export const KNOWN_SUPPLIERS: Known[] = [
  // Webshops / apparatuur
  { name: 'Amazon', re: /amazon(\.nl|\.de|\.com|\s*eu|\s*services)?|amzn/i, category: KLEIN },
  { name: 'Bol', re: /\bbol\.com\b|\bbol\b.*b\.v\./i, category: KLEIN },
  { name: 'Coolblue', re: /coolblue/i, category: KLEIN },
  { name: 'MediaMarkt', re: /media\s?markt/i, category: KLEIN },
  { name: 'CameraNU', re: /camera\s?nu/i, category: KLEIN },
  { name: 'Kamera Express', re: /kamera\s?express/i, category: KLEIN },
  { name: 'Foto Konijnenberg', re: /konijnenberg/i, category: KLEIN },
  { name: 'Calumet', re: /calumet/i, category: KLEIN },
  { name: 'Bax Music', re: /bax[\s-]?(music|shop)/i, category: KLEIN },
  { name: 'Thomann', re: /thomann/i, category: KLEIN },
  { name: 'B&H Photo', re: /b\s?&\s?h\s+photo|bhphotovideo/i, category: KLEIN },
  { name: 'Apple', re: /apple\s+(distribution|store|b\.v\.)|apple\.com\/(nl|legal)|itunes/i, category: SW },
  { name: 'IKEA', re: /\bikea\b/i, category: KANTOOR },
  { name: 'Action', re: /\baction\b.*(nederland|b\.v\.)/i, category: KANTOOR },
  { name: 'HEMA', re: /\bhema\b/i, category: KANTOOR },
  { name: 'Gamma', re: /\bgamma\b/i, category: KANTOOR },
  { name: 'Praxis', re: /\bpraxis\b/i, category: KANTOOR },
  { name: 'Staples', re: /staples/i, category: KANTOOR },
  // Software
  { name: 'Adobe', re: /adobe/i, category: SW },
  { name: 'Google', re: /google\s+(cloud|ireland|workspace|one|llc)|google\.com\/(payments|workspace)/i, category: SW },
  { name: 'Microsoft', re: /microsoft/i, category: SW },
  { name: 'Dropbox', re: /dropbox/i, category: SW },
  { name: 'Capture One', re: /capture\s?one/i, category: SW },
  { name: 'Spotify', re: /spotify/i, category: SW },
  { name: 'Canva', re: /canva/i, category: SW },
  { name: 'Squarespace', re: /squarespace/i, category: SW },
  { name: 'Wix', re: /\bwix\.com\b/i, category: SW },
  { name: 'Pixieset', re: /pixieset/i, category: SW },
  { name: 'Pic-Time', re: /pic[\s-]?time/i, category: SW },
  { name: 'Vimeo', re: /vimeo/i, category: SW },
  { name: 'Frame.io', re: /frame\.io/i, category: SW },
  { name: 'Envato', re: /envato/i, category: SW },
  { name: 'Artlist', re: /artlist/i, category: SW },
  { name: 'Epidemic Sound', re: /epidemic\s?sound/i, category: SW },
  { name: 'TransIP', re: /transip/i, category: SW },
  { name: 'Strato', re: /strato/i, category: SW },
  { name: 'OpenAI', re: /openai/i, category: SW },
  { name: 'Anthropic', re: /anthropic/i, category: SW },
  // Telefoon / internet
  { name: 'KPN', re: /\bkpn\b/i, category: TEL },
  { name: 'Odido', re: /odido|t-mobile/i, category: TEL },
  { name: 'Vodafone', re: /vodafone/i, category: TEL },
  { name: 'Ziggo', re: /ziggo/i, category: TEL },
  { name: 'Simyo', re: /simyo/i, category: TEL },
  { name: 'Lebara', re: /lebara/i, category: TEL },
  { name: 'Ben', re: /\bben\.nl\b/i, category: TEL },
  // Reizen
  { name: 'NS', re: /\bns\.nl\b|nederlandse\s+spoorwegen|\bns\s+reizigers/i, category: REIS },
  { name: 'Shell', re: /\bshell\b/i, category: REIS },
  { name: 'BP', re: /\bbp\b.*(station|nederland)/i, category: REIS },
  { name: 'Esso', re: /\besso\b/i, category: REIS },
  { name: 'TotalEnergies', re: /totalenergies|\btotal\b.*station/i, category: REIS },
  { name: 'Tango', re: /\btango\b/i, category: REIS },
  { name: 'Tinq', re: /\btinq\b/i, category: REIS },
  { name: 'Q-Park', re: /q-?park/i, category: REIS },
  { name: 'Interparking', re: /interparking/i, category: REIS },
  { name: 'EasyPark', re: /easy\s?park/i, category: REIS },
  { name: 'Parkmobile', re: /parkmobile/i, category: REIS },
  { name: 'Yellowbrick', re: /yellowbrick/i, category: REIS },
  { name: 'Uber', re: /\buber\b/i, category: REIS },
  { name: 'Greenwheels', re: /greenwheels/i, category: REIS },
  { name: 'Arriva', re: /arriva/i, category: REIS },
  { name: 'Breng', re: /\bbreng\b/i, category: REIS },
  // Marketing / drukwerk
  { name: 'Meta', re: /meta\s+platforms|facebook\s+ireland/i, category: MARKETING },
  { name: 'LinkedIn', re: /linkedin/i, category: MARKETING },
  { name: 'Vistaprint', re: /vistaprint/i, category: MARKETING },
  { name: 'Drukwerkdeal', re: /drukwerkdeal/i, category: MARKETING },
  { name: 'Moo', re: /\bmoo\.com\b/i, category: MARKETING },
  { name: 'Saal Digital', re: /saal[\s-]?digital/i, category: MARKETING },
  { name: 'Albelli', re: /albelli/i, category: MARKETING },
  // Opleiding
  { name: 'Udemy', re: /udemy/i, category: OPL },
  { name: 'Domestika', re: /domestika/i, category: OPL },
  { name: 'Skillshare', re: /skillshare/i, category: OPL },
  { name: 'Bruna', re: /\bbruna\b/i, category: OPL },
  // Verzekering / bank
  { name: 'Centraal Beheer', re: /centraal\s+beheer/i, category: VERZ },
  { name: 'Interpolis', re: /interpolis/i, category: VERZ },
  { name: 'Allianz', re: /allianz/i, category: VERZ },
  { name: 'Hiscox', re: /hiscox/i, category: VERZ },
  { name: 'ASN Bank', re: /asn\s?bank/i, category: BANK },
  { name: 'ING', re: /\bing\s+bank\b/i, category: BANK },
  { name: 'Rabobank', re: /rabobank/i, category: BANK },
  { name: 'ABN AMRO', re: /abn\s?amro/i, category: BANK },
  { name: 'bunq', re: /\bbunq\b/i, category: BANK },
  { name: 'Knab', re: /\bknab\b/i, category: BANK },
  // Verhuur
  { name: 'Rent a Pro', re: /rent\s?a\s?pro/i, category: HUUR },
  { name: 'Lensrental', re: /lens\s?rental/i, category: HUUR },
]

/** Eigen bedrijfsnaam niet als leverancier herkennen. */
const OWN = /jorg\s+foto|jorg\s+van\s+gerner/i

export interface SupplierMatch {
  name: string
  category: string
  source: 'historie' | 'bekend'
}

/**
 * 1. Leverancier die je eerder hebt ingeboekt (naam komt voor in de tekst) → zelfde categorie als laatste keer.
 * 2. Bekende leverancier uit de lijst.
 */
export function matchSupplier(text: string, history: Expense[]): SupplierMatch | null {
  const t = text.replace(OWN, ' ')
  const seen = new Map<string, Expense>()
  for (const e of [...history].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = e.supplier.trim().toLowerCase()
    if (key.length >= 3 && !seen.has(key)) seen.set(key, e)
  }
  const lower = t.toLowerCase()
  // Langste naam eerst, zodat "Kamera Express" wint van "Express"
  for (const [key, e] of [...seen].sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i')
    if (re.test(lower)) return { name: e.supplier, category: e.category, source: 'historie' }
  }
  const k = KNOWN_SUPPLIERS.find((s) => s.re.test(t))
  if (k) {
    const prev = [...seen.values()].find((e) => e.supplier.toLowerCase() === k.name.toLowerCase())
    return { name: k.name, category: prev?.category || k.category, source: 'bekend' }
  }
  return null
}
