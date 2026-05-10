// Materiaal-opties + bijbehorende afwerkingen voor het toestemmingsformulier.
// 2-staps keuze: eerst materiaal, dan finish.

export interface FinishOption {
  code: string
  label: string
  surcharge?: number  // meerprijs in euro
}

export interface MaterialOption {
  code: string
  label: string
  finishes: FinishOption[]
  finishLabel?: string  // bv. "Afwerking" / "Type sieraad"
}

export const MATERIALS: MaterialOption[] = [
  {
    code: 'PB',
    label: 'Print Basic',
    finishes: [
      { code: 'PB1', label: 'White - gloss' },
      { code: 'PB2', label: 'Black - gloss' },
    ],
  },
  {
    code: 'PD',
    label: 'Print Deluxe',
    finishes: [
      { code: 'PD1', label: 'White - matte' },
      { code: 'PD2', label: 'Creme - matte' },
      { code: 'PD3', label: 'Taupe - matte' },
      { code: 'PD4', label: 'Silver' },
      { code: 'PD5', label: 'Gold' },
      { code: 'PD6', label: 'Graphite' },
      { code: 'PD7', label: 'Bronze' },
      { code: 'PD8', label: 'Copper' },
      { code: 'PD9', label: 'Warm gold' },
      { code: 'PD10', label: 'Premium royal blue', surcharge: 15 },
      { code: 'PD11', label: 'Premium rouge', surcharge: 15 },
      { code: 'PD12', label: 'Premium pink', surcharge: 15 },
      { code: 'PD13', label: 'Premium green', surcharge: 15 },
    ],
  },
  {
    code: 'MC',
    label: 'Metaal Coating',
    finishes: [
      { code: 'MC1', label: 'Gold' },
      { code: 'MC2A', label: 'Copper' },
      { code: 'MC2B', label: 'Copper dark patina' },
      { code: 'MC2C', label: 'Copper black patina' },
      { code: 'MC3A', label: 'Bronze' },
      { code: 'MC3B', label: 'Bronze dark patina' },
      { code: 'MC3C', label: 'Bronze blue patina' },
      { code: 'MC4', label: 'Tin' },
      { code: 'MC5', label: 'Steel' },
      { code: 'MC6', label: 'Warm gold' },
      { code: 'MC7', label: 'Pink' },
      { code: 'MC8', label: 'Taupe' },
    ],
  },
  {
    code: 'SC',
    label: 'Steen Composiet',
    finishes: [
      { code: 'SC3', label: 'White marble' },
      { code: 'SC4', label: 'Marble black-white' },
      { code: 'SC5', label: 'Marble terra-white' },
      { code: 'SC6', label: 'Natural' },
      { code: 'SC7', label: 'Yellowstone' },
      { code: 'SC8', label: 'Anthracite' },
    ],
  },
  {
    code: 'EB',
    label: 'Epoxy Beeld',
    finishes: [
      { code: 'EB1A', label: 'Epoxy transparent gloss' },
      { code: 'EB1B', label: 'Epoxy transparent matte' },
      { code: 'EB2', label: 'Epoxy gold leaf' },
      { code: 'EB3A', label: 'Epoxy taupe gloss' },
      { code: 'EB3B', label: 'Epoxy taupe matte' },
      { code: 'EB4A', label: 'Epoxy black gloss' },
      { code: 'EB4B', label: 'Epoxy black matte' },
      { code: 'EB5A', label: 'Epoxy blue gloss' },
      { code: 'EB5B', label: 'Epoxy blue matte' },
      { code: 'EB6A', label: 'Epoxy green gloss' },
      { code: 'EB6B', label: 'Epoxy green matte' },
      { code: 'EB7A', label: 'Epoxy pink gloss' },
      { code: 'EB7B', label: 'Epoxy pink matte' },
    ],
  },
  {
    code: 'MB',
    label: 'Metal Bronze',
    finishes: [
      { code: 'MB1A', label: 'Blue-green' },
      { code: 'MB1B', label: 'Green' },
      { code: 'MB2', label: 'Black shading' },
      { code: 'MB3A', label: 'Polished-Gloss' },
      { code: 'MB3B', label: 'Unpolished - light patina' },
      { code: 'MB4', label: 'Green shading' },
      { code: 'MB5', label: 'Blue shading' },
      { code: 'MB6', label: 'Old dark' },
      { code: 'MB8', label: 'Dark blue-green shading' },
      { code: 'MB9', label: 'Black' },
      { code: 'MB10', label: 'Gold-white' },
      { code: 'MB11', label: 'full-white' },
      { code: 'MB_OTHER', label: 'Other, please specify' },
    ],
  },
  {
    code: 'GP',
    label: 'Gold Plated beeld',
    finishes: [
      { code: 'GP1', label: 'Gold' },
      { code: 'GP2', label: 'Rose gold', surcharge: 70 },
    ],
  },
  {
    code: 'G',
    label: 'Glas',
    finishes: [
      { code: 'G1', label: 'Ruby red' },
      { code: 'G2', label: 'Blush' },
    ],
  },
  {
    code: 'S',
    label: 'Silver beeld',
    finishes: [
      { code: 'S', label: 'Silver' },
    ],
  },
  {
    code: 'JS',
    label: 'Jewelry Silver',
    finishLabel: 'Type sieraad',
    finishes: [
      { code: 'JS1', label: 'Pregnancy' },
      { code: 'JS2', label: 'Coin' },
      { code: 'JS3', label: 'Other' },
    ],
  },
  {
    code: 'JPG',
    label: 'Jewelry Plated Gold',
    finishLabel: 'Type sieraad',
    finishes: [
      { code: 'JPG1', label: 'Pregnancy' },
      { code: 'JPG2', label: 'Coin' },
      { code: 'JPG3', label: 'Other' },
    ],
  },
  {
    code: 'JG',
    label: 'Jewelry Gold',
    finishLabel: 'Type sieraad',
    finishes: [
      { code: 'JG1', label: 'Pregnancy' },
      { code: 'JG2', label: 'Coin' },
      { code: 'JG3', label: 'Other' },
    ],
  },
]

export const SIZES = ['12cm', '15cm', '17cm', '20cm', '25cm', '30cm', 'Anders, namelijk...']

export function findMaterial(code: string): MaterialOption | undefined {
  return MATERIALS.find(m => m.code === code)
}

export function findFinishLabel(materialCode: string, finishCode: string): string {
  const mat = findMaterial(materialCode)
  if (!mat) return finishCode
  const f = mat.finishes.find(x => x.code === finishCode)
  return f ? `${f.code} ${f.label}${f.surcharge ? ` (+€${f.surcharge})` : ''}` : finishCode
}
