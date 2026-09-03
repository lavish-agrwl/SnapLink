import type { ReactNode } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Toaster } from '@/components/ui/sonner';

interface AppLayoutProps {
  children?: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <Toaster position="top-right" />
      <Navigation />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 md:px-8 md:py-8 flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
