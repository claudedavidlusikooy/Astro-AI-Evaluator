import './globals.css'

export const metadata = {
  title: 'Astro AI Challenge Evaluator',
  description: 'Submission screening tool for People team',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
