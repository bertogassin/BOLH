import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { AdminThemeControl } from '@/components/AdminThemeControl'

export const metadata: Metadata = {
  title: 'Guardian Admin',
  description: 'Guardian platform control panel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('bolh-admin-theme');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t}catch(e){}})()` }} /></head>
      <body className="min-h-screen bg-gray-50 dark:bg-guardian-dark text-gray-900 dark:text-white">
        <Providers><AdminThemeControl />{children}</Providers>
      </body>
    </html>
  )
}
