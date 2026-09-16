import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { brandingUrl } from '@/lib/storage';
import { getCurrentSeason } from '@/lib/queries/seasons';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const season = await getCurrentSeason();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-gold-400 focus:px-4 focus:py-2 focus:text-navy-950"
      >
        Skip to content
      </a>

      <SiteHeader logoUrl={brandingUrl('moby-dicks-logo.webp')} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter seasonName={season?.name} />
    </div>
  );
}
