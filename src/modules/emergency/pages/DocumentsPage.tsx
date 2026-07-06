import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { DocumentType } from '@/lib/types';
import { Plus, FileText, Trash2, Filter, Download, Paperclip, X, Loader2 } from 'lucide-react';
import { useDocuments, useDocumentMutations, useTerminals } from '@/api';

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
  const [filterType, setFilterType] = useState<string>('');
  const [filterTerminal, setFilterTerminal] = useState<string>('');
  const [form, setForm] = useState({ title: '', docType: 'Plano de Ação de Emergência' as DocumentType, description: '', fileName: '', terminalId: '' });

  if (!user) return null;

  const canUpload = user.role === 'admin' || user.role === 'terminal';
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');

  // O escopo por papel/terminal é do back; aqui só os filtros de tela.
  let documents = allDocuments;
  if (filterType) documents = documents.filter(d => d.docType === filterType);
  if (filterTerminal) documents = documents.filter(d => d.terminalId === filterTerminal);

  const getTerminalName = (d: { terminalId: string }) =>
    (d as any).terminalName || terminals.find(t => t.id === d.terminalId)?.name || d.terminalId;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  const handleAdd = () => {
    if (!form.title || !form.fileName) return;
    if (user.role === 'admin' && !form.terminalId) { toast.error('Selecione o terminal'); return; }
    create.mutate(
      {
        title: form.title,
        docType: form.docType,
        description: form.description || undefined,
        fileName: form.fileName,
        terminalId: user.role === 'admin' ? form.terminalId : undefined,
      },
      {
        onSuccess: () => {
          setForm({ title: '', docType: 'Plano de Ação de Emergência', description: '', fileName: '', terminalId: '' });
          setShowForm(false);
          toast.success('Documento cadastrado');
        },
        onError,
      },
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este documento?')) return;
    remove.mutate(id, { onSuccess: () => toast.success('Documento excluído'), onError });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-foreground">Biblioteca de Documentos</h2>
        </div>
        {canUpload && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Documento
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-muted-foreground" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground">
          <option value="">Todos os tipos</option>
          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {terminals.length > 1 && (
          <select value={filterTerminal} onChange={e => setFilterTerminal(e.target.value)} className="px-3 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground">
            <option value="">Todos os terminais</option>
            {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {(filterType || filterTerminal) && (
          <button onClick={() => { setFilterType(''); setFilterTerminal(''); }} className="text-[10px] text-primary font-bold hover:underline">Limpar filtros</button>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono-data">{documents.length} documento(s)</span>
      </div>

      {/* Upload form (só metadados — upload real de arquivo na Fase 6) */}
      {showForm && canUpload && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm text-foreground">Novo Documento</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Título do documento" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground" />
            <select value={form.docType} onChange={e => setForm(f => ({ ...f, docType: e.target.value as DocumentType }))} className="px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground">
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {user.role === 'admin' && (
            <select value={form.terminalId} onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground">
              <option value="">Selecione o terminal...</option>
              {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground min-h-[50px]" />
          <input placeholder="Nome do arquivo (ex: plano-emergencia.pdf)" value={form.fileName} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={create.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-60 flex items-center gap-1.5">
              {create.isPending && <Loader2 size={12} className="animate-spin" />} Salvar Documento
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-2">
        {isLoading && (
          <p className="p-6 text-sm text-muted-foreground bg-card border border-border rounded-xl text-center flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando documentos...</p>
        )}
        {isError && !isLoading && <p className="p-6 text-sm text-primary bg-card border border-border rounded-xl text-center">Falha ao carregar documentos da API.</p>}
        {!isLoading && !isError && documents.length === 0 && <p className="p-6 text-sm text-muted-foreground italic bg-card border border-border rounded-xl text-center">Nenhum documento encontrado.</p>}
        {documents.map(doc => (
          <div key={doc.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 hover:border-primary/20 transition-colors">
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
              <button className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Download">
                <Download size={14} />
              </button>
              {canUpload && (
                <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Excluir">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
