import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { MessageSquare, Send, User, Shield, Ship } from 'lucide-react';
import { useOccurrenceChat, useChatMutations } from '@/api';

interface Props {
  occurrenceId: string;
}

const roleIcon = (role: string) => {
  switch (role) {
    case 'admin': return <Shield size={10} />;
    case 'terminal': return <Ship size={10} />;
    case 'entity': return <User size={10} />;
    default: return <User size={10} />;
  }
};

const roleBadge = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-primary/10 text-primary';
    case 'terminal': return 'bg-warning/10 text-warning';
    case 'entity': return 'bg-accent/10 text-accent';
    default: return 'bg-secondary text-muted-foreground';
  }
};

const roleLabel = (role: string) => {
  switch (role) {
    case 'admin': return 'Admin';
    case 'terminal': return 'Terminal';
    case 'entity': return 'Entidade';
    default: return role;
  }
};

export function OccurrenceChat({ occurrenceId }: Props) {
  const { user } = useAuth();
  // Chat real via API (ChatMessage — DER); tempo real via RealtimeBridge
  const { data: messages = [] } = useOccurrenceChat(occurrenceId);
  const { send } = useChatMutations(occurrenceId);
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!user) return null;

  const sendMessage = () => {
    const text = message.trim();
    if (!text || send.isPending) return;
    send.mutate(text, {
      onSuccess: () => setMessage(''),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao enviar mensagem'),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dt: string) =>
    new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  // Group messages by date
  let lastDate = '';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col" style={{ height: 420 }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <MessageSquare size={14} className="text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Comunicação Interna</h3>
        <span className="text-[10px] font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
          {messages.length}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageSquare size={28} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda.</p>
            <p className="text-[10px] text-muted-foreground/60">Inicie a comunicação sobre esta ocorrência.</p>
          </div>
        )}
        {messages.map(msg => {
          const isOwn = msg.userId === user.id;
          const dateStr = formatDate(msg.dateTime);
          let showDateDivider = false;
          if (dateStr !== lastDate) {
            showDateDivider = true;
            lastDate = dateStr;
          }
          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{dateStr}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isOwn ? 'order-1' : ''}`}>
                  {!isOwn && (
                    <div className="flex items-center gap-1.5 mb-0.5 px-1">
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${roleBadge(msg.userRole)}`}>
                        {roleIcon(msg.userRole)} {roleLabel(msg.userRole)}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">{msg.userName}</span>
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-xl text-xs ${
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-secondary text-foreground rounded-bl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <p className={`text-[9px] text-muted-foreground mt-0.5 px-1 ${isOwn ? 'text-right' : ''}`}>
                    {formatTime(msg.dateTime)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground resize-none min-h-[36px] max-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim()}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          Comunicação restrita aos participantes desta ocorrência · Enter para enviar
        </p>
      </div>
    </div>
  );
}
