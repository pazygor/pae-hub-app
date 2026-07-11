import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth-context';
import { PresentationModeProvider } from '@/lib/presentation-mode';
import { ViewModeProvider } from '@/app/layout/ViewModeProvider';
import { NotificationsProvider } from '@/lib/notifications';
import { RealtimeBridge } from '@/api/realtime';

const queryClient = new QueryClient();

/** Providers globais da aplicação (antes espalhados entre App.tsx e Index.tsx). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <NotificationsProvider>
            <RealtimeBridge />
            <PresentationModeProvider>
              <ViewModeProvider>
                <Toaster />
                <Sonner />
                {children}
              </ViewModeProvider>
            </PresentationModeProvider>
          </NotificationsProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
