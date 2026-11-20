import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Check a home on House Checker',
  description: 'Checks a San Francisco listing against city records and acts on what is still unknown.',
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f5f8' }, { media: '(prefers-color-scheme: dark)', color: '#050508' }],
};

/* Blocking boot: theme, reduced motion and font size before first paint. Three independent try blocks. */
const BOOT = `(function(){var d=document.documentElement,p=null,rm=null,fs=null;
try{p=localStorage.getItem('hc-theme')}catch(e){p=null}
try{rm=localStorage.getItem('hc-reduce-motion')}catch(e){rm=null}
try{fs=localStorage.getItem('hc-font-size')}catch(e){fs=null}
var s=p==='light'||p==='dark'?p:p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):'dark';
d.setAttribute('data-theme',s);d.setAttribute('data-theme-scheme',s);d.style.colorScheme=s;
if(rm==='1'||(rm!=='0'&&matchMedia('(prefers-reduced-motion: reduce)').matches))d.classList.add('reduce-motion');
if(fs==='small'||fs==='large')d.setAttribute('data-font-size',fs);})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
