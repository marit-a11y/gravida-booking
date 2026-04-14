/**
 * Meta Pixel base loader.
 * Plaats één keer in app/layout.tsx. Firet automatisch PageView bij elke route-change.
 */
'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '785237213362171'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

function PageViewOnRouteChange() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined' || !window.fbq) return
    window.fbq('track', 'PageView')
  }, [pathname, searchParams])

  return null
}

export default function MetaPixel() {
  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${PIXEL_ID}');
            // PageView wordt gevuurd door PageViewOnRouteChange (ook op route changes)
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      <Suspense fallback={null}>
        <PageViewOnRouteChange />
      </Suspense>
    </>
  )
}

/**
 * Track helper voor client-side events met event-id (voor CAPI deduplicatie).
 *
 * Gebruik:
 *   import { trackPixel } from '@/components/MetaPixel'
 *   trackPixel('Lead', { content_name: 'Scan-boeking' }, eventIdFromServer)
 */
export function trackPixel(
  eventName: string,
  data: Record<string, unknown> = {},
  eventId?: string,
) {
  if (typeof window === 'undefined' || !window.fbq) return
  if (eventId) {
    window.fbq('track', eventName, data, { eventID: eventId })
  } else {
    window.fbq('track', eventName, data)
  }
}
