## Análise do que já existe vs. o que precisa ser criado

### Já existe:
- EntityNotification com status (Notificada/Confirmada/Pendente)
- Timeline de eventos nas ocorrências
- Geração de PDF de incidentes
- Regras de notificação por tipo de ocorrência
- Dispatch de emergência com registro automático

### Precisa ser melhorado/criado:

1. **Atualizar EntityNotification** - adicionar status "em atendimento", registrar hora de acionamento e quem acionou
2. **Criar view OrchestrationView** - painel centralizado de orquestração com:
   - Status de entidades acionadas (acionado → confirmado → em atendimento)
   - Log de ações auditável e imutável
   - Métricas automáticas (tempo de resposta, tempo até acionamento, etc.)
3. **Melhorar timeline** - marcar como imutável (read-only após registro)
4. **Métricas automáticas** - calcular tempos de resposta e exibir
5. **Relatório automático ao encerrar** - gerar PDF automaticamente ao resolver ocorrência
6. **Adicionar ao menu/sidebar** - novo módulo "orchestration"

### Arquivos a modificar:
- `src/lib/types.ts` - novos tipos e status
- `src/lib/data.ts` - dados iniciais atualizados
- `src/components/pae/OrchestrationView.tsx` - novo componente
- `src/components/pae/PAESystem.tsx` - adicionar view
- `src/components/pae/AppSidebar.tsx` - adicionar menu
