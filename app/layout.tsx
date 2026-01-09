import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '名古屋ばえスカウター | NAGOYA VIBE CHECK',
  description: 'その写真、でら名古屋だがね！AIが独断と偏見で採点する名古屋ばえチェッカー',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
