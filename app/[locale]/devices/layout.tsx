import { Navbar } from '@/components/layout/navbar';

export default function DevicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </>
  );
}
