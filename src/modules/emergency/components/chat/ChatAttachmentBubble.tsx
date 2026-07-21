import { FileText, Download } from 'lucide-react';
import { fileUrl } from '@/api/client';
import { ChatAttachment } from '@/lib/types';

interface Props {
  attachment: ChatAttachment;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Item 10: render do anexo por tipo (imagem/vídeo/áudio/documento). O `src` é a URL
// assinada resolvida com fileUrl(); o endpoint GET /files/:id é público (a assinatura
// é a credencial), então <img>/<video>/<audio> carregam direto, sem header de auth.
export function ChatAttachmentBubble({ attachment }: Props) {
  const src = fileUrl(attachment.url) ?? '';
  const mime = attachment.mimeType || '';

  if (mime.startsWith('image/')) {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block">
        <img
          src={src}
          alt={attachment.originalName}
          loading="lazy"
          className="rounded-lg max-h-52 max-w-full object-cover"
        />
      </a>
    );
  }

  if (mime.startsWith('video/')) {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        className="rounded-lg max-h-56 max-w-full bg-black/40"
      />
    );
  }

  if (mime.startsWith('audio/')) {
    return <audio src={src} controls preload="metadata" className="w-56 max-w-full h-9" />;
  }

  // Documento (pdf/doc/ppt/…): card com nome, tamanho e download.
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      download={attachment.originalName}
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-background/40 hover:bg-background/60 transition-colors max-w-[220px]"
    >
      <FileText size={22} className="shrink-0 opacity-80" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium leading-tight">{attachment.originalName}</p>
        <p className="text-[9px] opacity-70">{humanSize(attachment.size)}</p>
      </div>
      <Download size={14} className="shrink-0 opacity-70" />
    </a>
  );
}
