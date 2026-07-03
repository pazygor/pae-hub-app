import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth-context';
import { PresentationModeProvider } from '@/lib/presentation-mode';

const queryClient = new QueryClient();

/** Providers globais da aplicação (antes espalhados entre App.tsx e Index.tsx). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PresentationModeProvider>
            <Toaster />
            <Sonner />
            {children}
          </PresentationModeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
