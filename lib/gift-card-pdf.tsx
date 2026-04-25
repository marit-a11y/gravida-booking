import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer'

// Register Helvetica (built-in, no download needed)
const BRAND_GREEN = '#3d5c41'
const BRAND_LIGHT = '#f0f5f1'
const BRAND_DARK  = '#1e2d1f'

const styles = StyleSheet.create({
  page: {
    backgroundColor: BRAND_GREEN,
    padding: 0,
    width: 595,   // A5 landscape ≈ 559x396, using A4 width for cleaner print
    height: 397,
    fontFamily: 'Helvetica',
  },
  inner: {
    flex: 1,
    padding: 40,
    flexDirection: 'row',
  },
  // Left column: branding + value
  left: {
    width: '38%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.18)',
    paddingRight: 30,
  },
  brand: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  valueLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    fontSize: 52,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    letterSpacing: -1,
  },
  // Right column: details
  right: {
    flex: 1,
    paddingLeft: 30,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  toLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recipientName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginTop: 5,
    marginBottom: 2,
  },
  typeLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  messageBox: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 8,
    padding: '10 14',
    marginTop: 12,
  },
  messageText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
  codeSection: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: '12 16',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    fontSize: 8,
    color: BRAND_GREEN,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  codeText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    letterSpacing: 3,
  },
  expiryText: {
    fontSize: 8,
    color: '#8a9e8c',
    textAlign: 'right',
  },
  footer: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 10,
  },
})

type GiftCardPdfParams = {
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

function GiftCardDocument({ params }: { params: GiftCardPdfParams }) {
  const typeLabel = TYPE_LABELS[params.type] ?? 'Cadeaubon'
  const expiresFormatted = new Date(params.expires_at).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const valueStr = params.value_euros % 1 === 0
    ? `€${params.value_euros}`
    : `€${params.value_euros.toFixed(2)}`

  return (
    <Document>
      <Page size={[595, 397]} style={styles.page}>
        <View style={styles.inner}>
          {/* Left */}
          <View style={styles.left}>
            <View>
              <Text style={styles.brand}>Gravida</Text>
              <Text style={styles.tagline}>zwangerschapsfotografie & sieraden</Text>
            </View>
            <View>
              <Text style={styles.valueLabel}>Waarde</Text>
              <Text style={styles.value}>{valueStr}</Text>
            </View>
          </View>

          {/* Right */}
          <View style={styles.right}>
            <View>
              <Text style={styles.toLabel}>Voor</Text>
              <Text style={styles.recipientName}>{params.recipient_name}</Text>
              <Text style={styles.typeLabel}>{typeLabel}</Text>
              {params.personal_message ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>"{params.personal_message}"</Text>
                </View>
              ) : null}
            </View>

            <View>
              <View style={styles.codeSection}>
                <View>
                  <Text style={styles.codeLabel}>Cadeauboncode</Text>
                  <Text style={styles.codeText}>{params.code}</Text>
                </View>
                <View>
                  <Text style={styles.expiryText}>Geldig tot</Text>
                  <Text style={styles.expiryText}>{expiresFormatted}</Text>
                </View>
              </View>
              <Text style={styles.footer}>
                Inwisselen op www.gravida.nl/maak-je-zwangerschapsbeeld · Van {params.purchaser_name}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function generateGiftCardPdf(params: GiftCardPdfParams): Promise<Buffer> {
  const buffer = await renderToBuffer(<GiftCardDocument params={params} />)
  return Buffer.from(buffer)
}
