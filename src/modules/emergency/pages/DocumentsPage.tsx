import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { DocumentType, PAEDocument } from '@/lib/types';
import { Plus, FileText, Trash2, Filter, Download, Paperclip, X, Loader2 } from 'lucide-react';
import { useDocuments, useDocumentMutations, useTerminals } from '@/api';
import { fileUrl } from '@/api/client';
import { FileUploadField } from '@/components/common/FileUploadField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const DOC_TYPES: DocumentType[] = [
  'Plano de Ação de Emergência',
  'Rotas de evacuação',
  'Contatos de emergência',
  'Plantas operacionais',
  'Procedimentos operacionais',
  'Outros',
];

const docTypeIcon = (t: DocumentType) => {
  switch (t) {
    case 'Plano de Ação de Emergência': return '📋';
    case 'Rotas de evacuação': return '🗺️';
    case 'Contatos de emergência': return '📞';
    case 'Plantas operacionais': return '📐';
    case 'Procedimentos operacionais': return '📝';
    default: return '📄';
  }
};

export function DocumentsPage() {
  const { user } = useAuth();
  const { data: allDocuments = [], isLoading, isError } = useDocuments();
  const { data: terminals = [] } = useTerminals();
  const { create, remove } = useDocumentMutations();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTerminal, setFilterTerminal] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<PAEDocument | null>(null);
  const [form, setForm] = useState({ title: '', docType: 'Plano de Ação de Emergência' as DocumentType, description: '', fileName: '', fileId: '', fileUrl: '', terminalId: '' });

  if (!user) return null;

  const canUpload = user.role === 'admin' || user.role === 'terminal';
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');
  const inputCls = 'w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary';
  const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1';

  // O escopo por papel/terminal é do back; aqui só os filtros de tela.
  let documents = allDocuments;
  if (filterType !== 'all') documents = documents.filter(d => d.docType === filterType);
  if (filterTerminal !== 'all') documents = documents.filter(d => d.terminalId === filterTerminal);

  const getTerminalName = (d: { terminalId: string }) =>
    (d as any).terminalName || terminals.find(t => t.id === d.terminalId)?.name || d.terminalId;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  const handleAdd = () => {
    if (!form.title.trim()) { toast.error('Informe o título do documento'); return; }
    if (!form.fileId) { toast.error('Envie o arquivo do documento'); return; }
    if (user.role === 'admin' && !form.terminalId) { toast.error('Selecione o terminal'); return; }
    create.mutate(
      {
        title: form.title,
        docType: form.docType,
        description: form.description || undefined,
        fileName: form.fileName,
        fileId: form.fileId,
        terminalId: user.role === 'admin' ? form.terminalId : undefined,
      },
      {
        onSuccess: () => {
          setForm({ title: '', docType: 'Plano de Ação de Emergência', description: '', fileName: '', fileId: '', fileUrl: '', terminalId: '' });
          setShowForm(false);
          toast.success('Documento cadastrado');
        },
        onError,
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const title = deleteTarget.title;
    remove.mutate(deleteTarget.id, { onSuccess: () => toast.success(`Documento "${title}" excluído`), onError });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-foreground">Biblioteca de Documentos</h2>
        </div>
        {canUpload && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Documento
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-auto min-w-[180px] cursor-pointer h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">Todos os tipos</SelectItem>
            {DOC_TYPES.map(t => <SelectItem key={t} value={t} className="cursor-pointer">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {terminals.length > 1 && (
          <Select value={filterTerminal} onValueChange={setFilterTerminal}>
            <SelectTrigger className="w-auto min-w-[160px] cursor-pointer h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">Todos os terminais</SelectItem>
              {terminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {(filterType !== 'all' || filterTerminal !== 'all') && (
          <button onClick={() => { setFilterType('all'); setFilterTerminal('all'); }} className="text-[10px] text-primary font-bold hover:underline cursor-pointer">Limpar filtros</button>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono-data">{documents.length} documento(s)</span>
      </div>

      {/* Upload form (só metadados — upload real de arquivo na Fase 6) */}
      {showForm && canUpload && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm text-foreground">Novo Documento</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Título *</label>
              <input placeholder="Título do documento" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <Select value={form.docType} onValueChange={v => setForm(f => ({ ...f, docType: v as DocumentType }))}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => <SelectItem key={t} value={t} className="cursor-pointer">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {user.role === 'admin' && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Terminal *</label>
                <Select value={form.terminalId} onValueChange={v => setForm(f => ({ ...f, terminalId: v }))}>
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione o terminal..." /></SelectTrigger>
                  <SelectContent>
                    {terminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} min-h-[50px]`} />
          </div>
          <div>
            <label className={labelCls}>Arquivo *</label>
            <FileUploadField
              value={form.fileId}
              fileName={form.fileName}
              currentUrl={form.fileUrl}
              kind="document"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*"
              onChange={f => setForm(prev => ({ ...prev, fileId: f?.id ?? '', fileName: f?.name ?? '', fileUrl: '' }))}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={create.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-1.5">
              {create.isPending && <Loader2 size={12} className="animate-spin" />} Salvar Documento
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-md cursor-pointer hover:bg-secondary/80 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-2">
        {isLoading && (
          <p className="p-6 text-sm text-muted-foreground bg-card border border-border rounded-lg text-center flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando documentos...</p>
        )}
        {isError && !isLoading && <p className="p-6 text-sm text-primary bg-card border border-border rounded-lg text-center">Falha ao carregar documentos da API.</p>}
        {!isLoading && !isError && documents.length === 0 && <p className="p-6 text-sm text-muted-foreground italic bg-card border border-border rounded-lg text-center">Nenhum documento encontrado.</p>}
        {documents.map(doc => (
          <div key={doc.id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-4 hover:border-primary/20 transition-colors">
            <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center text-lg shrink-0">
              {docTypeIcon(doc.docType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-bold text-foreground">{doc.title}</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-secondary text-secondary-foreground">{doc.docType}</span>
              </div>
              <p className="text-xs text-muted-foreground">{doc.description}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Paperclip size={10} /> {doc.fileName}
                </span>
                <span className="text-[10px] text-muted-foreground">{getTerminalName(doc)}</span>
                <span className="text-[10px] text-muted-foreground font-mono-data">{fmtDate(doc.uploadDate)}</span>
                <span className="text-[10px] text-muted-foreground">{doc.userName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {doc.fileUrl ? (
                <a href={fileUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" title="Baixar/abrir">
                  <Download size={14} />
                </a>
              ) : (
                <span className="p-1.5 text-muted-foreground/30" title="Sem arquivo (documento legado)">
                  <Download size={14} />
                </span>
              )}
              {canUpload && (
                <button onClick={() => setDeleteTarget(doc)} className="p-1.5 text-muted-foreground hover:text-emergency transition-colors cursor-pointer" title="Excluir">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmação de remoção (AlertDialog — substitui o confirm() nativo) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="p-1.5 bg-primary/10 rounded-lg"><Trash2 size={16} className="text-primary" /></span>
              Excluir documento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O documento <strong className="text-foreground font-semibold">{deleteTarget?.title}</strong> será removido
              da biblioteca. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
