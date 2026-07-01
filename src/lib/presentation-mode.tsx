import { createContext, useContext, useState, ReactNode } from 'react';

interface PresentationModeContextType {
  presentationMode: boolean;
  togglePresentationMode: () => void;
}

const PresentationModeContext = createContext<PresentationModeContextType>({
  presentationMode: false,
  togglePresentationMode: () => {},
});

export function PresentationModeProvider({ children }: { children: ReactNode }) {
  const [presentationMode, setPresentationMode] = useState(false);
  return (
    <PresentationModeContext.Provider value={{ presentationMode, togglePresentationMode: () => setPresentationMode(p => !p) }}>
      {children}
    </PresentationModeContext.Provider>
  );
}

export function usePresentationMode() {
  return useContext(PresentationModeContext);
}

/** Mask an email: "admin@m1.com" → "a•••@m•.com" */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '•••@•••.•••';
  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '•••';
  const domParts = domain.split('.');
  const maskedDomain = domParts.map(p => p[0] + '•'.repeat(Math.max(p.length - 1, 1))).join('.');
  return `${maskedLocal}@${maskedDomain}`;
}

/** Mask a phone: "(13) 3200-0000" → "(••) ••••-••••" */
export function maskPhone(phone: string): string {
  if (!phone || phone === '—') return phone;
  return phone.replace(/\d/g, '•');
}

/** Mask a name: "Carlos Silva" → "C•••• S••••" */
export function maskName(name: string): string {
  if (!name) return '•••••';
  return name.split(' ').map(w => w[0] + '•'.repeat(Math.max(w.length - 1, 1))).join(' ');
}

/** Generic mask for contact text */
export function maskContact(text: string): string {
  if (!text || text === '—') return text;
  if (text.includes('@')) return maskEmail(text);
  if (/\d/.test(text)) return maskPhone(text);
  return text[0] + '•'.repeat(Math.max(text.length - 1, 2));
}
