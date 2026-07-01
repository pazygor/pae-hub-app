import jsPDF from 'jspdf';
import { AppData, Occurrence } from '@/lib/types';

export function generateIncidentPDF(occurrence: Occurrence, data: AppData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 20; // margin x
  const mxr = pw - mx;
  let y = 20;

  const terminal = data.terminals.find(t => t.id === occurrence.terminalId);
  const plans = data.plans.filter(p => p.terminalId === occurrence.terminalId);
  const risks = data.risks.filter(r => r.terminalId === occurrence.terminalId);
  const docs = data.documents.filter(d => d.terminalId === occurrence.terminalId);
  const entities = data.entities.filter(e => {
    const perm = data.permissions.find(p => p.entityId === e.id);
    return perm?.terminalIds.includes(occurrence.terminalId);
  });

  const hasPlanActivated = occurrence.timeline.some(ev => ev.type === 'plano de emergência ativado');

  // Colors
  const red: [number, number, number] = [220, 38, 38];
  const black: [number, number, number] = [15, 15, 16];
  const gray: [number, number, number] = [120, 120, 120];

  const addPage = () => {
    doc.addPage();
    y = 20;
    addFooter();
  };

  const checkPage = (needed: number) => {
    if (y + needed > ph - 25) addPage();
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text('M1 PAE Hub — Plataforma de Gestão de Emergências Operacionais', mx, ph - 12);
    doc.text('© M1 – Todos os direitos reservados', mx, ph - 8);
    doc.text(`Página ${doc.getNumberOfPages()}`, mxr, ph - 8, { align: 'right' });
  };

  const sectionTitle = (title: string) => {
    checkPage(14);
    y += 4;
    doc.setFontSize(11);
    doc.setTextColor(...red);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), mx, y);
    y += 2;
    doc.setDrawColor(...red);
    doc.setLineWidth(0.5);
    doc.line(mx, y, mxr, y);
    y += 6;
    doc.setTextColor(...black);
  };

  const labelValue = (label: string, value: string) => {
    checkPage(8);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gray);
    doc.text(label, mx, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    doc.text(value || '—', mx + 40, y);
    y += 5.5;
  };

  const wrapText = (text: string, maxWidth: number): string[] => {
    return doc.splitTextToSize(text, maxWidth);
  };

  // ========== HEADER ==========
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...red);
  doc.text('M1', mx, y);
  doc.setTextColor(...black);
  doc.text('PAE Hub', mx + 7, y);
  y += 8;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('Relatório de Incidente', mx, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, mx, y);
  y += 4;

  doc.setDrawColor(...red);
  doc.setLineWidth(0.8);
  doc.line(mx, y, mxr, y);
  y += 8;

  addFooter();

  // ========== 1. IDENTIFICAÇÃO ==========
  sectionTitle('Identificação da Ocorrência');
  labelValue('Nº Ocorrência', occurrence.incNumber);
  labelValue('Terminal', terminal?.name || occurrence.terminalId);
  labelValue('Tipo', occurrence.type);
  labelValue('Criticidade', occurrence.criticality.toUpperCase());
  labelValue('Status', occurrence.status.toUpperCase());
  labelValue('Data/Hora Abertura', new Date(occurrence.dateTime).toLocaleString('pt-BR'));

  const resolvedEvent = occurrence.timeline.find(ev => ev.type === 'ocorrência resolvida');
  labelValue('Data/Hora Encerramento', resolvedEvent ? new Date(resolvedEvent.dateTime).toLocaleString('pt-BR') : 'Em andamento');

  // ========== 2. RESUMO ==========
  sectionTitle('Resumo do Incidente');
  labelValue('Responsável', occurrence.responsible);
  labelValue('Equipe', occurrence.team);

  checkPage(12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gray);
  doc.text('Descrição', mx, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);
  const descLines = wrapText(occurrence.description, mxr - mx);
  for (const line of descLines) {
    checkPage(6);
    doc.text(line, mx, y);
    y += 4.5;
  }
  y += 2;

  // ========== 3. LINHA DO TEMPO ==========
  sectionTitle('Linha do Tempo do Incidente');
  if (occurrence.timeline.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('Nenhum evento registrado.', mx, y);
    y += 6;
  } else {
    for (const ev of occurrence.timeline) {
      checkPage(14);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...black);
      const dt = new Date(ev.dateTime).toLocaleString('pt-BR');
      doc.text(`${dt}  |  ${ev.type.toUpperCase()}`, mx, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      const evLines = wrapText(`${ev.description} — ${ev.userName}`, mxr - mx);
      for (const line of evLines) {
        checkPage(5);
        doc.text(line, mx, y);
        y += 4;
      }
      y += 2;
    }
  }

  // ========== 4. AÇÕES EXECUTADAS ==========
  sectionTitle('Ações Executadas');
  labelValue('Plano de Emergência', hasPlanActivated ? 'Ativado' : 'Não ativado');

  if (plans.length > 0) {
    for (const plan of plans) {
      checkPage(8);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...black);
      doc.text(`Plano: ${plan.name} (${plan.status})`, mx, y);
      y += 5;
      for (const item of plan.checklist) {
        checkPage(5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        doc.text(`${item.done ? '☑' : '☐'} ${item.text}`, mx + 4, y);
        y += 4;
      }
      y += 2;
    }
  }

  // ========== 5. ENTIDADES ==========
  sectionTitle('Entidades Envolvidas');
  if (entities.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('Nenhuma entidade vinculada.', mx, y);
    y += 6;
  } else {
    for (const ent of entities) {
      checkPage(6);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      doc.text(`• ${ent.name} — ${ent.type} (${ent.status})`, mx, y);
      y += 5;
    }
    y += 2;
  }

  // ========== 6. DOCUMENTOS ==========
  sectionTitle('Documentos Anexos');
  if (docs.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('Nenhum documento vinculado.', mx, y);
    y += 6;
  } else {
    for (const d of docs) {
      checkPage(6);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      doc.text(`• ${d.title} (${d.docType}) — ${d.fileName}`, mx, y);
      y += 5;
    }
    y += 2;
  }

  // ========== 7. RISCOS ==========
  sectionTitle('Riscos Relacionados');
  if (risks.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('Nenhum risco vinculado.', mx, y);
    y += 6;
  } else {
    for (const r of risks) {
      checkPage(6);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      doc.text(`• ${r.type} (${r.level.toUpperCase()}) — ${r.affectedArea}`, mx, y);
      y += 5;
    }
  }

  // Save
  doc.save(`Relatorio_Incidente_${occurrence.incNumber}.pdf`);
}
