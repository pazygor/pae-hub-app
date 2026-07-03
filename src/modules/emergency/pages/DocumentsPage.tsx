import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PAEDocument, DocumentType } from '@/lib/types';
import { Plus, FileText, Trash2, Filter, Download, Paperclip, X } from 'lucide-react';

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

export function DocumentsView() {
  const { user, data, setData } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterTerminal, setFilterTerminal] = useState<string>('');
  const [form, setForm] = useState({ title: '', docType: 'Plano de Ação de Emergência' as DocumentType, description: '', fileName: '' });

  const visibleTerminalIds = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return data.terminals.map(t => t.id);
    if (user.role === 'terminal') return user.linkId ? [user.linkId] : [];
    if (user.role === 'entity') return data.permissions.find(p => p.entityId === user.linkId)?.terminalIds || [];
    return [];
  }, [user, data]);

  if (!user) return null;

  const canUpload = user.role === 'admin' || user.role === 'terminal';

  let documents = data.documents.filter(d => visibleTerminalIds.includes(d.terminalId));
  if (filterType) documents = documents.filter(d => d.docType === filterType);
  if (filterTerminal) documents = documents.filter(d => d.terminalId === filterTerminal);

  const visibleTerminals = data.terminals.filter(t => visibleTerminalIds.includes(t.id));
  const getTerminalName = (id: string) => data.terminals.find(t => t.id === id)?.name || id;

  const handleAdd = () => {
    if (!form.title || !form.fileName) return;
    const terminalId = user.role === 'terminal' ? user.linkId! : visibleTerminalIds[0];
    const newDoc: PAEDocument = {
      id: `d${Date.now()}`,
      title: form.title,
      docType: form.docType,
      description: form.description,
      fileName: form.fileName,
      terminalId,
      uploadDate: new Date().toISOString().split('T')[0],
      userName: user.name,
    };
    setData(d => ({ ...d, documents: [...d.documents, newDoc] }));
    setForm({ title: '', docType: 'Plano de Ação de Emergência', description: '', fileName: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setData(d => ({ ...d, documents: d.documents.filter(doc => doc.id !== id) }));
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
        {visibleTerminals.length > 1 && (
          <select value={filterTerminal} onChange={e => setFilterTerminal(e.target.value)} className="px-3 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground">
            <option value="">Todos os terminais</option>
            {visibleTerminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {(filterType || filterTerminal) && (
          <button onClick={() => { setFilterType(''); setFilterTerminal(''); }} className="text-[10px] text-primary font-bold hover:underline">Limpar filtros</button>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono-data">{documents.length} documento(s)</span>
      </div>

      {/* Upload form */}
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
          <textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground min-h-[50px]" />
          <input placeholder="Nome do arquivo (ex: plano-emergencia.pdf)" value={form.fileName} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg">Salvar Documento</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-2">
        {documents.length === 0 && <p className="p-6 text-sm text-muted-foreground italic bg-card border border-border rounded-xl text-center">Nenhum documento encontrado.</p>}
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
                <span className="text-[10px] text-muted-foreground">{getTerminalName(doc.terminalId)}</span>
                <span className="text-[10px] text-muted-foreground font-mono-data">{doc.uploadDate}</span>
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
