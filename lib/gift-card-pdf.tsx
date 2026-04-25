import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

// ─── Brand colours ────────────────────────────────────────────────────────────
const G_DARK   = '#1a3320'   // deep forest green – main background
const G_MID    = '#2d4a32'   // slightly lighter green for subtle panels
const G_GREEN  = '#3d5c41'   // brand green accent
const G_CREAM  = '#f7f3ec'   // warm cream – right panel & text highlights
const G_GOLD   = '#c9a96e'   // warm gold – separator line, labels
const G_WHITE  = '#ffffff'
const G_MUTED  = 'rgba(247,243,236,0.55)'   // muted cream

export type GiftCardPdfParams = {
  recipient_name: string
  purchaser_name: string
  code: string
  type: string
  value_euros: number
  personal_message?: string | null
  expires_at: string
}

const TYPE_LABELS: Record<string, string> = {
  digitaal: 'Digitale cadeaubon',
  gedrukt:  'Gedrukte cadeaubon',
  usb_box:  'USB Cadeaubox',
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    width: 595,
    height: 397,
    backgroundColor: G_DARK,
    fontFamily: 'Helvetica',
    flexDirection: 'row',
    overflow: 'hidden',
  },

  // ── Decorative background circles (top-right)
  circleOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: G_MID,
    top: -120,
    right: -80,
  },
  circleInner: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: G_GREEN,
    top: -60,
    right: -30,
  },
  // Small accent circle bottom-left
  circleAccent: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: G_MID,
    bottom: -30,
    left: 160,
  },

  // ── Left column (dark green, 42%)
  left: {
    width: '42%',
    paddingTop: 36,
    paddingBottom: 30,
    paddingLeft: 36,
    paddingRight: 28,
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  brandWrap: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: G_WHITE,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  brandSub: {
    fontSize: 7.5,
    color: G_GOLD,
    letterSpacing: 1.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  goldLine: {
    height: 1,
    backgroundColor: G_GOLD,
    marginTop: 16,
    marginBottom: 16,
    width: 40,
  },
  typeChip: {
    fontSize: 8,
    color: G_GOLD,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  valueCurrency: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: G_CREAM,
    marginTop: 8,
    marginRight: 2,
  },
  valueNumber: {
    fontSize: 68,
    fontFamily: 'Helvetica-Bold',
    color: G_WHITE,
    letterSpacing: -2,
    lineHeight: 1,
  },
  valueDecimal: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: G_CREAM,
    marginTop: 10,
  },
  fromText: {
    fontSize: 8.5,
    color: G_MUTED,
    marginTop: 10,
  },

  // ── Right column (cream, 58%)
  right: {
    flex: 1,
    backgroundColor: G_CREAM,
    paddingTop: 32,
    paddingBottom: 26,
    paddingLeft: 30,
    paddingRight: 30,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  rightTop: {
    flexDirection: 'column',
  },
  cadeaubonLabel: {
    fontSize: 8,
    color: G_GREEN,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  toLabel: {
    fontSize: 8,
    color: '#7a8e7c',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: G_DARK,
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd8cf',
    marginTop: 14,
    marginBottom: 14,
  },
  messageLabel: {
    fontSize: 7.5,
    color: '#9aab9c',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  messageText: {
    fontSize: 9.5,
    color: '#4a5e4c',
    fontStyle: 'italic',
    lineHeight: 1.65,
  },
  noMessage: {
    fontSize: 9,
    color: '#bbb5ac',
    fontStyle: 'italic',
  },
  // Bottom code area
  rightBottom: {
    flexDirection: 'column',
  },
  codeBox: {
    backgroundColor: G_DARK,
    borderRadius: 8,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    fontSize: 7,
    color: G_GOLD,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  codeText: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: G_WHITE,
    letterSpacing: 4,
  },
  expiryLabel: {
    fontSize: 7,
    color: G_MUTED,
    textAlign: 'right',
    marginBottom: 2,
  },
  expiryDate: {
    fontSize: 8.5,
    color: G_CREAM,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  redeemText: {
    fontSize: 7.5,
    color: '#7a8e7c',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function splitValue(euros: number): { whole: string; decimal: string | null } {
  if (euros % 1 === 0) return { whole: String(euros), decimal: null }
  const [w, d] = euros.toFixed(2).split('.')
  return { whole: w, decimal: d }
}

// ─── Document ─────────────────────────────────────────────────────────────────
function GiftCardDocument({ params }: { params: GiftCardPdfParams }) {
  const typeLabel = TYPE_LABELS[params.type] ?? 'Cadeaubon'
  const expiresFormatted = new Date(params.expires_at).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const { whole, decimal } = splitValue(params.value_euros)

  return (
    <Document>
      <Page size={[595, 397]} style={s.page}>

        {/* ── Decorative circles (behind left column) */}
        <View style={s.circleOuter} />
        <View style={s.circleInner} />
        <View style={s.circleAccent} />

        {/* ── Left: dark green branding + value */}
        <View style={s.left}>
          <View style={s.brandWrap}>
            <Text style={s.brandName}>Gravida</Text>
            <Text style={s.brandSub}>Zwangerschapsfotografie & Sieraden</Text>
            <View style={s.goldLine} />
            <Text style={s.typeChip}>{typeLabel}</Text>
          </View>

          <View>
            <View style={s.valueWrap}>
              <Text style={s.valueCurrency}>€</Text>
              <Text style={s.valueNumber}>{whole}</Text>
              {decimal ? <Text style={s.valueDecimal}>,{decimal}</Text> : null}
            </View>
            <Text style={s.fromText}>van {params.purchaser_name}</Text>
          </View>
        </View>

        {/* ── Right: cream panel with details + code */}
        <View style={s.right}>
          <View style={s.rightTop}>
            <Text style={s.cadeaubonLabel}>Cadeaubon</Text>
            <Text style={s.toLabel}>Voor</Text>
            <Text style={s.recipientName}>{params.recipient_name}</Text>
            <View style={s.divider} />
            {params.personal_message ? (
              <>
                <Text style={s.messageLabel}>Persoonlijk bericht</Text>
                <Text style={s.messageText}>"{params.personal_message}"</Text>
              </>
            ) : (
              <Text style={s.noMessage}>Veel plezier met je cadeaubon!</Text>
            )}
          </View>

          <View style={s.rightBottom}>
            <View style={s.codeBox}>
              <View>
                <Text style={s.codeLabel}>Jouw code</Text>
                <Text style={s.codeText}>{params.code}</Text>
              </View>
              <View>
                <Text style={s.expiryLabel}>Geldig tot</Text>
                <Text style={s.expiryDate}>{expiresFormatted}</Text>
              </View>
            </View>
            <Text style={s.redeemText}>
              Inwisselen op www.gravida.nl/maak-je-zwangerschapsbeeld
            </Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────
export async function generateGiftCardPdf(params: GiftCardPdfParams): Promise<Buffer> {
  const buffer = await renderToBuffer(<GiftCardDocument params={params} />)
  return Buffer.from(buffer)
}
