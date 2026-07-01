import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { IdCard, Phone, Mail, Copy, Check, Building2, User, Shield, Ship } from 'lucide-react';
import { usePresentationMode, maskEmail, maskPhone, maskName } from '@/lib/presentation-mode';

interface ContactCard {
  name: string;
  role: string;
  entity: string;
  entityType: 'terminal' | 'entity' | 'admin';
  phone: string;
  phoneSecondary: string;
  email: string;
}

export function BadgePAEView() {
  const { user, data } = useAuth();
  const { presentationMode } = usePresentationMode();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!user) return null;

  const pm = presentationMode;

  // Build contact cards from all users + terminals + entities
  const contacts: ContactCard[] = [];

  data.users.filter(u => u.role === 'admin').forEach(u => {
    contacts.push({
      name: u.name, role: 'Administrador do Sistema', entity: 'M1 PAE Hub', entityType: 'admin',
      phone: '(13) 3200-0000', phoneSecondary: '(13) 99900-0000', email: u.email,
    });
  });

  data.users.filter(u => u.role === 'terminal').forEach(u => {
    const terminal = data.terminals.find(t => t.id === u.linkId);
    contacts.push({
      name: u.name, role: terminal?.responsible === u.name ? 'Responsável pelo Terminal' : 'Operador do Terminal',
      entity: terminal?.name || 'Terminal', entityType: 'terminal',
      phone: terminal?.contact || '—', phoneSecondary: '—', email: u.email,
    });
  });

  data.users.filter(u => u.role === 'entity').forEach(u => {
    const entity = data.entities.find(e => e.id === u.linkId);
    contacts.push({
      name: u.name, role: `Representante - ${entity?.type || 'Entidade'}`,
      entity: entity?.name || 'Entidade', entityType: 'entity',
      phone: entity?.contact || '—', phoneSecondary: '—', email: u.email,
    });
  });

  data.terminals.forEach(t => {
    const alreadyAdded = contacts.some(c => c.name === t.responsible && c.entity === t.name);
    if (!alreadyAdded) {
      contacts.push({ name: t.responsible, role: 'Responsável pelo Terminal', entity: t.name, entityType: 'terminal', phone: t.contact, phoneSecondary: '—', email: '' });
    }
  });

  data.entities.forEach(ent => {
    const alreadyAdded = contacts.some(c => c.entity === ent.name);
    if (!alreadyAdded) {
      contacts.push({ name: ent.name, role: ent.type, entity: ent.name, entityType: 'entity', phone: ent.contact, phoneSecondary: '—', email: '' });
    }
  });

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
          <p className="text-xs text-muted-foreground">Contatos de emergência para comunicação rápida</p>
        </div>
      </div>

      {pm && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center gap-2">
          <span className="text-accent text-xs">👁</span>
          <p className="text-xs text-accent font-medium">
            <strong>Modo Apresentação ativo</strong> — Nomes, telefones e emails estão mascarados. O Crachá do PAE centraliza contatos críticos para comunicação rápida em emergências.
          </p>
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Phone size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Este módulo centraliza os contatos críticos para comunicação em caso de emergência. 
          Utilize os botões de ação rápida para <strong className="text-foreground">ligar</strong>, <strong className="text-foreground">enviar e-mail</strong> ou <strong className="text-foreground">copiar</strong> as informações de contato.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {contacts.map((contact, idx) => {
          const cardId = `${contact.name}-${idx}`;
          const displayName = pm ? maskName(contact.name) : contact.name;
          const displayPhone = pm ? maskPhone(contact.phone) : contact.phone;
          const displayPhoneSec = pm ? maskPhone(contact.phoneSecondary) : contact.phoneSecondary;
          const displayEmail = pm ? maskEmail(contact.email) : contact.email;
          const contactText = `${contact.name} | ${contact.role} | ${contact.entity} | Tel: ${contact.phone} | Email: ${contact.email}`;

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
                    {displayPhoneSec !== '—' && <span className="text-muted-foreground">/ {displayPhoneSec}</span>}
                  </div>
                  {contact.email && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail size={12} className="text-muted-foreground shrink-0" />
                      <span className="text-foreground font-medium truncate">{displayEmail}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  {contact.phone !== '—' && (
                    <a href={pm ? '#' : `tel:${contact.phone.replace(/\D/g, '')}`} onClick={pm ? (e) => e.preventDefault() : undefined}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-success/10 text-success rounded-lg text-[11px] font-bold hover:bg-success/20 transition-colors border border-success/20">
                      <Phone size={12} /> Ligar
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
