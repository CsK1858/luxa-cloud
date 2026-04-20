import { Navbar } from '@/components/layout/navbar';
import { PortalNav } from '@/components/ui/portal-nav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
      <PortalNav activeId="cloud" />
    </>
  );
}
