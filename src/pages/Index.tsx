import { AuthProvider } from '@/lib/auth-context';
import { PresentationModeProvider } from '@/lib/presentation-mode';
import { PAESystem } from '@/components/pae/PAESystem';

const Index = () => (
  <AuthProvider>
    <PresentationModeProvider>
      <PAESystem />
    </PresentationModeProvider>
  </AuthProvider>
);

export default Index;
