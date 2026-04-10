import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gravida – Zwangerschapsscans aan huis',
  description: 'Plan eenvoudig een zwangerschapsscan bij u thuis. Kies een datum en tijdstip dat u uitkomt.',
  openGraph: {
    title: 'Gravida – Zwangerschapsscans aan huis',
    description: 'Plan eenvoudig een zwangerschapsscan bij u thuis.',
    locale: 'nl_NL',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gravida-off-white text-gravida-green min-h-screen">
        {children}
      </body>
    </html>
  )
}
