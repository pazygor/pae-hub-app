import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { MessageSquare, Send, User, Shield, Ship, Paperclip, Mic, X, Loader2, Trash2, FileText, Camera } from 'lucide-react';
import { useOccurrenceChat, useChatMutations } from '@/api';
import { filesApi, FileKind } from '@/api/files';
import { ChatAttachmentBubble } from './chat/ChatAttachmentBubble';
import { useAudioRecorder } from './chat/useAudioRecorder';

interface Props {
  occurrenceId: string;
}

// Limite único de 50MB para qualquer tipo (o back é a fonte da verdade e só barra
// executáveis). Sem `accept`: qualquer extensão pode ser anexada.
const MAX_UPLOAD = 50 * 1024 * 1024;

const kindOf = (mime: string): FileKind => {
  if (mime.startsWith('image/')) return 'chat_image';
  if (mime.startsWith('video/')) return 'chat_video';
  if (mime.startsWith('audio/')) return 'chat_audio';
  return 'chat_document';
};

const humanSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Câmera direta (só mobile): reusa o mesmo onPickFile/preview/upload do clipe.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const rec = useAudioRecorder();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Object URL do preview: revoga ao trocar/limpar o anexo pendente.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    if (pendingFile.type.startsWith('image/') || pendingFile.type.startsWith('video/')) {
      const url = URL.createObjectURL(pendingFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [pendingFile]);

  if (!user) return null;

  const busy = uploading || send.isPending;

  const clearPending = () => setPendingFile(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite repicar o mesmo arquivo
    if (!file) return;
    if (file.size > MAX_UPLOAD) {
      toast.error(`Arquivo muito grande (máx. ${humanSize(MAX_UPLOAD)}).`);
      return;
    }
    setPendingFile(file);
  };

  const sendWithAttachment = async (file: File, caption: string) => {
    setUploading(true);
    try {
      const up = await filesApi.upload(file, kindOf(file.type));
      await send.mutateAsync({ message: caption || undefined, fileId: up.id });
      setMessage('');
      setPendingFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar o anexo');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = () => {
    if (busy) return;
    if (pendingFile) {
      sendWithAttachment(pendingFile, message.trim());
      return;
    }
    const text = message.trim();
    if (!text) return;
    send.mutate(
      { message: text },
      {
        onSuccess: () => setMessage(''),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao enviar mensagem'),
      },
    );
  };

  const startRecording = async () => {
    if (!rec.supported) {
      toast.error('Gravação de áudio indisponível neste navegador. Anexe um arquivo de áudio.');
      return;
    }
    try {
      await rec.start();
    } catch {
      toast.error('Não foi possível acessar o microfone. Verifique a permissão.');
    }
  };

  const stopAndSendRecording = async () => {
    const file = await rec.stop();
    if (file) await sendWithAttachment(file, '');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dt: string) =>
    new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const showSendButton = !!pendingFile || message.trim().length > 0;

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
                  <div className={`rounded-xl text-xs overflow-hidden ${
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-secondary text-foreground rounded-bl-sm'
                  } ${msg.attachment ? 'p-1' : 'px-3 py-2'}`}>
                    {msg.attachment && <ChatAttachmentBubble attachment={msg.attachment} />}
                    {msg.message && (
                      <p className={`whitespace-pre-wrap break-words ${msg.attachment ? 'px-2 py-1' : ''}`}>{msg.message}</p>
                    )}
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
        {rec.isRecording ? (
          <div className="flex items-center gap-2">
            <button
              onClick={rec.cancel}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
              title="Descartar"
            >
              <Trash2 size={16} />
            </button>
            <div className="flex-1 flex items-center gap-2 text-xs text-foreground">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="font-mono">Gravando… {mmss(rec.seconds)}</span>
            </div>
            <button
              onClick={stopAndSendRecording}
              disabled={busy}
              className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
              title="Enviar áudio"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        ) : (
          <>
            {/* Preview do anexo pendente */}
            {pendingFile && (
              <div className="mb-2 flex items-center gap-2 p-2 bg-secondary rounded-lg">
                {previewUrl && pendingFile.type.startsWith('image/') && (
                  <img src={previewUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                )}
                {previewUrl && pendingFile.type.startsWith('video/') && (
                  <video src={previewUrl} className="w-10 h-10 rounded object-cover shrink-0 bg-black/40" />
                )}
                {!previewUrl && <FileText size={20} className="shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-foreground">{pendingFile.name}</p>
                  <p className="text-[9px] text-muted-foreground">{humanSize(pendingFile.size)}</p>
                </div>
                <button onClick={clearPending} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" onChange={onPickFile} className="hidden" />
              {/* `capture` abre a câmera direto no celular; ignorado no desktop.
                  accept image+video → foto ou vídeo, como o WhatsApp. */}
              <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" onChange={onPickFile} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0 disabled:opacity-40"
                title="Anexar imagem, vídeo ou documento"
              >
                <Paperclip size={16} />
              </button>
              {/* Câmera: só no mobile (md:hidden). No desktop o clipe já cobre tudo. */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={busy}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0 disabled:opacity-40"
                title="Tirar foto ou gravar vídeo"
              >
                <Camera size={16} />
              </button>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingFile ? 'Adicione uma legenda…' : 'Digite sua mensagem…'}
                rows={1}
                className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground resize-none min-h-[36px] max-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showSendButton ? (
                <button
                  onClick={handleSend}
                  disabled={busy}
                  className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
                  title="Enviar"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={busy}
                  className="p-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/70 transition-colors shrink-0 disabled:opacity-40"
                  title="Gravar áudio"
                >
                  <Mic size={16} />
                </button>
              )}
            </div>
          </>
        )}
        <p className="text-[9px] text-muted-foreground mt-1.5">
          Comunicação restrita aos participantes desta ocorrência · Enter para enviar
        </p>
      </div>
    </div>
  );
}
