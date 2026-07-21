import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Paperclip, Loader2, X, Download } from 'lucide-react';
import { filesApi, FileKind } from '@/api/files';
import { fileUrl } from '@/api/client';

interface Props {
  /** id do FileAsset já vinculado (edição). */
  value?: string;
  /** nome atual do arquivo (exibição). */
  fileName?: string;
  /** URL assinada atual (para baixar o já vinculado). */
  currentUrl?: string;
  kind?: FileKind;
  accept?: string;
  disabled?: boolean;
  /** Chamado no sucesso do upload / ao remover (fileId undefined). */
  onChange: (file: { id: string; name: string } | null) => void;
}

/**
 * Campo de upload reutilizável (item 4). Faz o upload na hora e devolve o fileId +
 * nome; o download do já-vinculado usa a URL assinada (`currentUrl`).
 */
export function FileUploadField({
  value, fileName, currentUrl, kind = 'other', accept, disabled, onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await filesApi.upload(file, kind);
      onChange({ id: up.id, name: up.originalName });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const href = fileUrl(currentUrl);

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || uploading}
        onChange={e => handlePick(e.target.files?.[0])}
      />

      {value && fileName ? (
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 h-10">
          <Paperclip size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground truncate flex-1">{fileName}</span>
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" title="Abrir/baixar"
              className="text-muted-foreground hover:text-foreground shrink-0"><Download size={14} /></a>
          )}
          {!disabled && (
            <button type="button" onClick={() => onChange(null)} title="Remover"
              className="text-muted-foreground hover:text-destructive shrink-0"><X size={14} /></button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 w-full h-10 px-3 rounded-md border border-dashed border-input bg-background text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-60 cursor-pointer"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {uploading ? 'Enviando…' : 'Selecionar arquivo'}
        </button>
      )}
    </div>
  );
}
