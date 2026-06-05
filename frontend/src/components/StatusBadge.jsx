const STATUS_MAP = {
  // Client statuses
  active: { label: 'Ativo', cls: 'badge-green' },
  inactive: { label: 'Inativo', cls: 'badge-gray' },
  paused: { label: 'Pausado', cls: 'badge-yellow' },

  // Campaign statuses
  created: { label: 'Criada', cls: 'badge-gray' },
  analyzing: { label: 'Analisando...', cls: 'badge-blue' },
  topics_ready: { label: 'Assuntos prontos', cls: 'badge-blue' },
  draft_generated: { label: 'Rascunho gerado', cls: 'badge-yellow' },
  pending_approval: { label: 'Aguardando aprovação', cls: 'badge-yellow' },
  approved: { label: 'Aprovado', cls: 'badge-green' },
  posted: { label: 'Publicado', cls: 'badge-green' },
  paused_until: { label: 'Pausada', cls: 'badge-yellow' },
  completed: { label: 'Concluída', cls: 'badge-green' },
  error: { label: 'Erro', cls: 'badge-red' },
};

export default function StatusBadge({ status }) {
  const info = STATUS_MAP[status] || { label: status, cls: 'badge-gray' };
  return <span className={`badge ${info.cls}`}>{info.label}</span>;
}
