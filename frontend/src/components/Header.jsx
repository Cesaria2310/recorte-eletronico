import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { removeToken, api, formatCompact } from '../api.js';

function fmtRemaining(min) {
  if (!min || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function fmtClock(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

// Widget "claudeusagestick": espelha o monitor de uso do Claude Code
// (rotina bridge) — janela móvel de 5h, custo/tokens de hoje, mês e por modelo.
function ClaudeUsageWidget() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef(null);

  async function fetchUsage() {
    try {
      const result = await api('/api/usage/claude-code');
      setData(result);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    fetchUsage();
    intervalRef.current = setInterval(fetchUsage, 45000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!data) return null;

  const today = data.today || {};
  const month = data.month || {};
  const w = data.window5h || {};
  const tokensToday = (today.tokens_in || 0) + (today.tokens_out || 0);
  const costToday = typeof today.cost_usd === 'number' ? today.cost_usd.toFixed(2) : '0.00';
  // A barra reflete a janela de 5h (limite de uso), como no dispositivo.
  const pct = Math.min(100, Math.max(0, w.limit_pct || 0));
  const overLimit = (w.limit_pct || 0) >= 100;

  return (
    <div
      className="claude-usage-pill"
      onClick={() => setExpanded((v) => !v)}
      title="Monitor do Claude Code — janela de 5h. Clique para detalhes"
    >
      <div className="claude-usage-main">
        <span className="claude-usage-icon">✦</span>
        <span className="claude-usage-label">Claude</span>
        <span className="claude-usage-tokens">{formatCompact(tokensToday)}</span>
        <span className="claude-usage-cost">US${costToday}</span>
        <span className="claude-usage-window">{w.limit_pct ?? 0}%·5h</span>
      </div>
      <div className="claude-budget-bar">
        <div
          className="claude-budget-fill"
          style={{
            width: `${pct}%`,
            background: overLimit ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--primary)',
          }}
        />
      </div>
      {expanded && (
        <div className="claude-usage-tooltip" onClick={(e) => e.stopPropagation()}>
          <div className="claude-usage-tooltip-title">Monitor do Claude Code</div>

          <div className="claude-usage-tooltip-section">Janela de 5h {w.active ? '🟢' : '⚪'}</div>
          <div className="claude-usage-tooltip-row">
            <span>Uso do limite</span>
            <span className="num">{w.limit_pct ?? 0}% · US$ {(w.cost_usd ?? 0).toFixed(2)}/{(w.limit_usd ?? 0).toFixed(0)}</span>
          </div>
          <div className="claude-usage-tooltip-row">
            <span>Mensagens</span>
            <span className="num">{w.messages ?? 0}</span>
          </div>
          <div className="claude-usage-tooltip-row">
            <span>Reseta em</span>
            <span className="num">{fmtRemaining(w.remaining_min)} ({fmtClock(w.reset_at)})</span>
          </div>

          <div className="claude-usage-tooltip-divider" />
          <div className="claude-usage-tooltip-section">Hoje</div>
          <div className="claude-usage-tooltip-row">
            <span>Tokens</span>
            <span className="num">{formatCompact(tokensToday)}</span>
          </div>
          <div className="claude-usage-tooltip-row">
            <span>Custo</span>
            <span className="num">US$ {costToday}</span>
          </div>
          <div className="claude-usage-tooltip-row">
            <span>Mês</span>
            <span className="num">US$ {(month.cost_usd ?? 0).toFixed(2)} / {(data.budget_monthly_usd ?? 0).toFixed(0)}</span>
          </div>

          {Array.isArray(data.by_model) && data.by_model.length > 0 && (
            <>
              <div className="claude-usage-tooltip-divider" />
              <div className="claude-usage-tooltip-section">Por modelo</div>
              {data.by_model.slice(0, 3).map((m) => (
                <div className="claude-usage-tooltip-row" key={m.name}>
                  <span className="claude-usage-model">{m.name}</span>
                  <span className="num">US$ {(m.cost_usd ?? 0).toFixed(2)}</span>
                </div>
              ))}
            </>
          )}

          {!data.source_available && (
            <div className="claude-usage-tooltip-note">
              Sem dados de uso local do Claude Code neste ambiente. A rotina lê
              <code> ~/.claude/projects</code> na máquina onde o Claude Code roda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header({ user }) {
  const navigate = useNavigate();

  function handleLogout() {
    removeToken();
    navigate('/login');
  }

  return (
    <header className="header">
      <Link to="/" className="header-brand">
        <span className="header-brand-icon">✂</span>
        <span className="header-brand-text">Recorte Eletrônico</span>
      </Link>
      <div className="header-right">
        <div className="header-right-info">
          {user && (
            <span className="header-user">
              Olá, <strong>{user.name}</strong>
            </span>
          )}
          <ClaudeUsageWidget />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}
