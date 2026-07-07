import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { IdCard, Phone, Mail, Copy, Check, Building2, Shield, Ship, Search, MessageCircle, Siren } from 'lucide-react';
import { usePresentationMode, maskEmail, maskPhone, maskName } from '@/lib/presentation-mode';
import { useUserContacts, useTerminals, useEntities } from '@/api';

interface ContactCard {
  name: string;
  role: string;
  entity: string;
  entityType: 'terminal' | 'entity' | 'admin';
  phone: string;
  email: string;
}

// Atalhos fixos de emergência (Funcional §3.9)
const EMERGENCY_SHORTCUTS = [
  { label: 'Bombeiros', number: '193' },
  { label: 'Defesa Civil', number: '199' },
  { label: 'IBAMA (Linha Verde)', number: '0800 61 8080' },
];

/** Converte um telefone BR em link do WhatsApp (wa.me). */
function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

const ACCESS_LABEL: Record<string, string> = {
  'estratégico': 'Diretoria (Estratégico)',
  'tático': 'Supervisor (Tático)',
  'operacional': 'Executor (Operacional)',
};

export function BadgePage() {
  const { user } = useAuth();
  const { presentationMode } = usePresentationMode();
  // Comunicação rápida sobre cadastros REAIS (GET /users/contacts — todos os papéis)
  const { data: userContacts = [], isLoading } = useUserContacts();
  const { data: terminals = [] } = useTerminals();
  const { data: entities = [] } = useEntities();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const pm = presentationMode;

  const contacts: ContactCard[] = useMemo(() => {
    const cards: ContactCard[] = [];

    // 1) Usuários reais — telefone próprio com fallback para o contato do terminal
    for (const c of userContacts) {
      if (c.role === 'admin') {
        cards.push({
          name: c.name, role: 'Administrador do Sistema', entity: 'M1 PAE Hub', entityType: 'admin',
          phone: c.phone || '—', email: c.email,
        });
      } else if (c.role === 'terminal') {
        cards.push({
          name: c.name,
          role: ACCESS_LABEL[c.accessLevel || ''] || 'Operador do Terminal',
          entity: c.terminal?.name || 'Terminal', entityType: 'terminal',
          phone: c.phone || c.terminal?.contact || '—', email: c.email,
        });
      } else {
        cards.push({
          name: c.name, role: 'Representante de Entidade', entity: 'Entidade Externa', entityType: 'entity',
          phone: c.phone || '—', email: c.email,
        });
      }
    }

    // 2) Responsáveis de terminais ainda não listados como usuários
    for (const t of terminals) {
      if (t.responsible && !cards.some(c => c.name === t.responsible)) {
        cards.push({
          name: t.responsible, role: 'Responsável pelo Terminal', entity: t.name, entityType: 'terminal',
          phone: t.contact || '—', email: '',
        });
      }
    }

    // 3) Entidades externas ativas (contato institucional)
    for (const ent of entities) {
      if (ent.status !== 'Ativo') continue;
      if (!cards.some(c => c.name === ent.name)) {
        cards.push({ name: ent.name, role: ent.type, entity: ent.name, entityType: 'entity', phone: ent.contact || '—', email: '' });
      }
    }

    return cards;
  }, [userContacts, terminals, entities]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || c.entity.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  if (!user) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const entityIcon = (type: ContactCard['entityType']) => {
    switch (type) {
      case 'admin': return <Shield size={14} className="text-primary" />;
      case 'terminal': return <Ship size={14} className="text-accent" />;
      case 'entity': return <Building2 size={14} className="text-warning" />;
    }
  };

  const entityBadgeColor = (type: ContactCard['entityType']) => {
    switch (type) {
      case 'admin': return 'bg-primary/10 text-primary border-primary/20';
      case 'terminal': return 'bg-accent/10 text-accent border-accent/20';
      case 'entity': return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const entityLabel = (type: ContactCard['entityType']) => {
    switch (type) {
      case 'admin': return 'ADMINISTRAÇÃO';
      case 'terminal': return 'TERMINAL';
      case 'entity': return 'ENTIDADE';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <IdCard size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Crachá do PAE</h2>
          <p className="text-xs text-muted-foreground">Listagem de usuários e contatos para comunicação rápida</p>
        </div>
      </div>

      {/* Atalhos de emergência (Funcional §3.9) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {EMERGENCY_SHORTCUTS.map(s => (
          <a
            key={s.number}
            href={`tel:${s.number.replace(/\D/g, '')}`}
            className="flex items-center gap-3 bg-primary/5 border border-primary/25 rounded-xl px-4 py-3 hover:bg-primary/10 transition-colors"
          >
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Siren size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{s.label}</p>
              <p className="text-base font-black text-primary font-mono-data">{s.number}</p>
            </div>
          </a>
        ))}
      </div>

      {pm && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center gap-2">
          <span className="text-accent text-xs">👁</span>
          <p className="text-xs text-accent font-medium">
            <strong>Modo Apresentação ativo</strong> — Nomes, telefones e emails estão mascarados. O Crachá do PAE centraliza contatos críticos para comunicação rápida em emergências.
          </p>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, função ou vínculo..."
          className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando contatos...</p>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum contato encontrado.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((contact, idx) => {
          const cardId = `${contact.name}-${idx}`;
          const displayName = pm ? maskName(contact.name) : contact.name;
          const displayPhone = pm ? maskPhone(contact.phone) : contact.phone;
          const displayEmail = pm ? maskEmail(contact.email) : contact.email;
          const contactText = `${contact.name} | ${contact.role} | ${contact.entity} | Tel: ${contact.phone} | Email: ${contact.email}`;
          const hasPhone = contact.phone !== '—' && contact.phone.replace(/\D/g, '').length >= 8;

          return (
            <div key={cardId} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all group">
              <div className={`h-1.5 ${contact.entityType === 'admin' ? 'bg-primary' : contact.entityType === 'terminal' ? 'bg-accent' : 'bg-warning'}`} />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${entityBadgeColor(contact.entityType)}`}>
                    {entityIcon(contact.entityType)}
                    {entityLabel(contact.entityType)}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-tight">{displayName}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{contact.role}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 size={12} className="shrink-0" />
                  <span className="truncate">{contact.entity}</span>
                </div>
                <div className="space-y-1.5 pt-1 border-t border-border">
                  <div className="flex items-center gap-2 text-xs">
                    <Phone size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground font-medium">{displayPhone}</span>
                  </div>
                  {contact.email && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail size={12} className="text-muted-foreground shrink-0" />
                      <span className="text-foreground font-medium truncate">{displayEmail}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  {hasPhone && (
                    <a
                      href={pm ? '#' : whatsappUrl(contact.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={pm ? (e) => e.preventDefault() : undefined}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-success/10 text-success rounded-lg text-[11px] font-bold hover:bg-success/20 transition-colors border border-success/20"
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  )}
                  {contact.email && (
                    <a href={pm ? '#' : `mailto:${contact.email}`} onClick={pm ? (e) => e.preventDefault() : undefined}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent/10 text-accent rounded-lg text-[11px] font-bold hover:bg-accent/20 transition-colors border border-accent/20">
                      <Mail size={12} /> E-mail
                    </a>
                  )}
                  <button onClick={() => copyToClipboard(contactText, cardId)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-[11px] font-bold hover:bg-secondary/80 transition-colors border border-border">
                    {copiedId === cardId ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    {copiedId === cardId ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
