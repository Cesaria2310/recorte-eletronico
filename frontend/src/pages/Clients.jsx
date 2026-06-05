import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import ClientForm from '../components/ClientForm.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/clients');
      setClients(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(payload) {
    setFormLoading(true);
    setFormError('');
    try {
      await api('/api/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setShowModal(false);
      loadClients();
    } catch (err) {
      setFormError(err.message || 'Erro ao criar cliente');
    } finally {
      setFormLoading(false);
    }
  }

  function getIntegrationLabel(mode) {
    return mode === 'instagram_graph' ? 'Graph API' : 'Mock';
  }

  function getAILabel(provider) {
    return provider === 'claude' ? 'Claude' : 'Mock';
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Gerencie os clientes e seus perfis de automação</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Novo cliente
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <Spinner />
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <p>Nenhum cliente cadastrado ainda.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => setShowModal(true)}
          >
            Cadastrar primeiro cliente
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {clients.map((c) => (
            <div
              key={c.id}
              className="client-card"
              onClick={() => navigate(`/clients/${c.id}`)}
            >
              <div className="client-card-header">
                <div>
                  <div className="client-name">{c.name}</div>
                  {c.instagram_handle && (
                    <div className="client-handle">@{c.instagram_handle}</div>
                  )}
                </div>
                <StatusBadge status={c.status || 'active'} />
              </div>

              {c.themes && c.themes.length > 0 && (
                <div className="client-meta">
                  {c.themes.slice(0, 4).map((t) => (
                    <span key={t} className="badge badge-blue">{t}</span>
                  ))}
                  {c.themes.length > 4 && (
                    <span className="badge badge-gray">+{c.themes.length - 4}</span>
                  )}
                </div>
              )}

              {c.contract && (
                <div className="client-info-row" style={{ marginTop: '0.75rem' }}>
                  <span title="Modo de integração">
                    🔗 {getIntegrationLabel(c.contract.integration_mode)}
                  </span>
                  <span title="Provedor de IA">
                    🤖 {getAILabel(c.contract.ai_provider)}
                  </span>
                  {c.contract.auto_post_when_approved && (
                    <span title="Auto-post ativo">⚡ Auto-post</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title="Novo cliente"
          onClose={() => { setShowModal(false); setFormError(''); }}
        >
          <ClientForm
            onSubmit={handleCreate}
            loading={formLoading}
            error={formError}
          />
        </Modal>
      )}
    </>
  );
}
