import { Old_Standard_TT, Cormorant_Garamond, Pinyon_Script } from 'next/font/google';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

const oldStandard = Old_Standard_TT({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-old-standard',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const pinyon = Pinyon_Script({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-pinyon',
  display: 'swap',
});

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${oldStandard.variable} ${cormorant.variable} ${pinyon.variable} min-h-screen bg-[#EDE8E1] text-[#4A4A50]`}
    >
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
