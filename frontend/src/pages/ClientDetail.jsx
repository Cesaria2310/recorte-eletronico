import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import ClientForm from '../components/ClientForm.jsx';

const TABS = ['contrato', 'cofre', 'midia', 'campanhas', 'instagram'];
const TAB_LABELS = {
  contrato: 'Contrato',
  cofre: '🔒 Cofre',
  midia: 'Biblioteca de mídia',
  campanhas: 'Campanhas',
  instagram: '📷 Instagram',
};

// ─── Instagram Tab ───────────────────────────────────────────────────────────

function InstagramTab({ clientId }) {
  // --- Assistente de conexão ---
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState('');
  const [accounts, setAccounts] = useState(null); // null = não validado ainda

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [exchangeLongLived, setExchangeLongLived] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState(''); // username após conectar

  // --- Status da conexão ---
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null); // {ok, username, name, error}
  const [testError, setTestError] = useState('');

  // --- Carrossel ---
  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]); // array de ids na ordem de seleção
  const [caption, setCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null); // {ok, detail}
  const [publishError, setPublishError] = useState('');

  // Carrega status da conexão e fotos ao abrir a aba
  useEffect(() => {
    testConnection(true);
    loadPhotos();
  }, [clientId]);

  async function loadPhotos() {
    setPhotosLoading(true);
    setPhotosError('');
    try {
      const data = await api(`/api/clients/${clientId}/media`);
      setPhotos(data.filter((m) => m.media_type === 'photo'));
    } catch (err) {
      setPhotosError(err.message || 'Erro ao carregar mídias.');
    } finally {
      setPhotosLoading(false);
    }
  }

  async function testConnection(silent = false) {
    if (!silent) setTestLoading(true);
    setTestError('');
    try {
      const data = await api(`/api/clients/${clientId}/instagram/test`);
      setTestResult(data);
    } catch (err) {
      if (err.status === 403) {
        setTestError('Apenas administradores podem configurar o Instagram.');
      } else {
        setTestResult({ ok: false, error: err.message || 'Erro ao testar conexão.' });
      }
    } finally {
      setTestLoading(false);
    }
  }

  async function handleValidate() {
    if (!accessToken.trim()) return;
    setValidating(true);
    setValidateError('');
    setAccounts(null);
    setSelectedAccountId('');
    setConnectError('');
    setConnectSuccess('');
    try {
      const data = await api(`/api/clients/${clientId}/instagram/validate-token`, {
        method: 'POST',
        body: JSON.stringify({ access_token: accessToken.trim() }),
      });
      setAccounts(data.accounts || []);
      // pré-seleciona a primeira conta com instagram_business_id
      const firstValid = (data.accounts || []).find((a) => a.instagram_business_id);
      if (firstValid) setSelectedAccountId(firstValid.instagram_business_id);
    } catch (err) {
      if (err.status === 403) {
        setValidateError('Apenas administradores podem configurar o Instagram.');
      } else {
        setValidateError(err.message || 'Erro ao validar token.');
      }
    } finally {
      setValidating(false);
    }
  }

  async function handleConnect() {
    if (!selectedAccountId) return;
    setConnecting(true);
    setConnectError('');
    setConnectSuccess('');
    try {
      const data = await api(`/api/clients/${clientId}/instagram/connect`, {
        method: 'POST',
        body: JSON.stringify({
          access_token: accessToken.trim(),
          instagram_business_id: selectedAccountId,
          exchange_long_lived: exchangeLongLived,
        }),
      });
      setConnectSuccess(data.connected_as || data.username || '');
      // Limpa token da tela por segurança
      setAccessToken('');
      setAccounts(null);
      setSelectedAccountId('');
      // Atualiza o status de conexão
      testConnection(true);
    } catch (err) {
      if (err.status === 403) {
        setConnectError('Apenas administradores podem configurar o Instagram.');
      } else {
        setConnectError(err.message || 'Erro ao conectar.');
      }
    } finally {
      setConnecting(false);
    }
  }

  function togglePhotoSelection(photoId) {
    setSelectedPhotos((prev) => {
      if (prev.includes(photoId)) {
        return prev.filter((id) => id !== photoId);
      }
      if (prev.length >= 10) return prev; // máximo 10
      return [...prev, photoId];
    });
  }

  async function handlePublish() {
    if (selectedPhotos.length < 2 || selectedPhotos.length > 10) return;
    setPublishing(true);
    setPublishError('');
    setPublishResult(null);
    try {
      const data = await api(`/api/clients/${clientId}/instagram/publish-carousel`, {
        method: 'POST',
        body: JSON.stringify({
          media_asset_ids: selectedPhotos,
          caption: caption.trim(),
          ...(firstComment.trim() ? { first_comment: firstComment.trim() } : {}),
        }),
      });
      setPublishResult(data);
      setSelectedPhotos([]);
      setCaption('');
      setFirstComment('');
    } catch (err) {
      if (err.status === 403) {
        setPublishError('Apenas administradores podem publicar no Instagram.');
      } else {
        setPublishError(err.message || 'Erro ao publicar carrossel.');
      }
    } finally {
      setPublishing(false);
    }
  }

  const canConnect = !connecting && selectedAccountId && accounts !== null;
  const canPublish = selectedPhotos.length >= 2 && selectedPhotos.length <= 10 && !publishing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Status da conexão ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Status da conexão</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => testConnection(false)}
            disabled={testLoading}
          >
            {testLoading ? 'Testando...' : 'Testar conexão'}
          </button>
        </div>
        <div className="card-body">
          {testError && (
            <div className="alert alert-warning">{testError}</div>
          )}
          {!testError && testResult && (
            testResult.ok ? (
              <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>✅</span>
                <div>
                  <strong>@{testResult.username}</strong>
                  {testResult.name && testResult.name !== testResult.username && (
                    <span style={{ marginLeft: '0.4rem', color: 'var(--success)' }}>— {testResult.name}</span>
                  )}
                  <div style={{ fontSize: '0.75rem', marginTop: '0.1rem', opacity: 0.8 }}>Conexão ativa e funcionando</div>
                </div>
              </div>
            ) : (
              <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚠️</span>
                <div>
                  <strong>Sem conexão ativa</strong>
                  {testResult.error && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.1rem' }}>{testResult.error}</div>
                  )}
                </div>
              </div>
            )
          )}
          {!testError && !testResult && testLoading && (
            <div className="text-sm text-muted">Verificando conexão...</div>
          )}
        </div>
      </div>

      {/* ── Assistente de conexão ─────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Assistente de conexão</span>
        </div>
        <div className="card-body">
          <div className="alert alert-info" style={{ marginBottom: '1.25rem', fontSize: '0.82rem' }}>
            <strong>🔒 Segurança:</strong> O token é salvo no Cofre criptografado e <strong>nunca</strong> é exibido novamente após a conexão.
          </div>

          {/* Instruções */}
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-700)', marginBottom: '1rem', lineHeight: '1.6' }}>
            Cole um token da Meta Graph API. O assistente descobrirá suas contas do Instagram automaticamente.{' '}
            <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer">
              Abrir o Explorador de API da Meta ↗
            </a>
          </p>
          <div className="alert alert-warning" style={{ marginBottom: '1.25rem', fontSize: '0.8rem' }}>
            <strong>Permissões necessárias no token:</strong>{' '}
            <code style={{ background: 'rgba(0,0,0,0.06)', padding: '0 3px', borderRadius: '3px' }}>instagram_basic</code>,{' '}
            <code style={{ background: 'rgba(0,0,0,0.06)', padding: '0 3px', borderRadius: '3px' }}>instagram_content_publish</code>,{' '}
            <code style={{ background: 'rgba(0,0,0,0.06)', padding: '0 3px', borderRadius: '3px' }}>pages_read_engagement</code>
          </div>

          {connectSuccess && (
            <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
              Conectada como <strong>@{connectSuccess}</strong> 🎉
            </div>
          )}

          {/* Passo 1 – token */}
          <div className="ig-step-block">
            <div className="ig-step-number">1</div>
            <div style={{ flex: 1 }}>
              <div className="ig-step-title">Validar token e descobrir contas</div>
              <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: '0' }}>
                <label>Access Token</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="EAABwzLixnjYBO..."
                    style={{ paddingRight: '2.5rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }}
                    autoComplete="off"
                    disabled={validating}
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)' }}
                    onClick={() => setShowToken((v) => !v)}
                    title={showToken ? 'Ocultar token' : 'Mostrar token'}
                  >
                    {showToken ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {validateError && (
                <div className="alert alert-error" style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.82rem' }}>
                  {validateError}
                </div>
              )}
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleValidate}
                  disabled={validating || !accessToken.trim()}
                >
                  {validating ? 'Validando...' : 'Validar e descobrir contas'}
                </button>
              </div>
            </div>
          </div>

          {/* Passo 2 – selecionar conta */}
          {accounts !== null && (
            <div className="ig-step-block" style={{ marginTop: '1rem' }}>
              <div className="ig-step-number">2</div>
              <div style={{ flex: 1 }}>
                <div className="ig-step-title">
                  Selecionar conta e conectar
                </div>
                {accounts.length === 0 ? (
                  <div className="alert alert-warning" style={{ marginTop: '0.75rem' }}>
                    Nenhuma conta encontrada para este token. Verifique as permissões e tente novamente.
                  </div>
                ) : (
                  <>
                    <div className="ig-accounts-grid" style={{ marginTop: '0.75rem' }}>
                      {accounts.map((acc) => {
                        const hasIg = !!acc.instagram_business_id;
                        const isSelected = selectedAccountId === acc.instagram_business_id;
                        return (
                          <label
                            key={acc.page_id}
                            className={`ig-account-card${isSelected ? ' selected' : ''}${!hasIg ? ' disabled' : ''}`}
                            style={{ cursor: hasIg ? 'pointer' : 'not-allowed' }}
                          >
                            <input
                              type="radio"
                              name="ig-account"
                              value={acc.instagram_business_id || ''}
                              checked={isSelected}
                              disabled={!hasIg}
                              onChange={() => hasIg && setSelectedAccountId(acc.instagram_business_id)}
                              style={{ display: 'none' }}
                            />
                            <div className="ig-account-header">
                              <span className="ig-account-username">
                                {hasIg ? `@${acc.username || acc.instagram_business_id}` : 'Sem Instagram vinculado'}
                              </span>
                              {isSelected && hasIg && (
                                <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>Selecionada</span>
                              )}
                              {!hasIg && (
                                <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>Indisponível</span>
                              )}
                            </div>
                            <div className="ig-account-page">{acc.page_name}</div>
                            {hasIg && (
                              <div className="ig-account-id tabular-nums">
                                ID: {acc.instagram_business_id}
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                      <label className="checkbox-group">
                        <input
                          type="checkbox"
                          checked={exchangeLongLived}
                          onChange={(e) => setExchangeLongLived(e.target.checked)}
                        />
                        Gerar token de longa duração (~60 dias)
                      </label>
                    </div>

                    {connectError && (
                      <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                        {connectError}
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      onClick={handleConnect}
                      disabled={!canConnect || !selectedAccountId}
                    >
                      {connecting ? 'Conectando...' : 'Conectar'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Publicação de carrossel ───────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Carrossel (2 a 10 fotos)</span>
          <span className="badge badge-gray" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {selectedPhotos.length}/10 selecionadas
          </span>
        </div>
        <div className="card-body">
          {publishResult && (
            <div className={`alert ${publishResult.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '1rem' }}>
              {publishResult.detail || (publishResult.ok ? 'Publicado com sucesso!' : 'Falha na publicação.')}
            </div>
          )}
          {publishError && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {publishError}
            </div>
          )}

          {photosLoading ? (
            <div className="text-sm text-muted">Carregando fotos...</div>
          ) : photosError ? (
            <div className="alert alert-error">{photosError}</div>
          ) : photos.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <div className="empty-state-icon">🖼️</div>
              <p>Nenhuma foto disponível. Envie fotos na aba <strong>Biblioteca de mídia</strong>.</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.75rem' }}>
                Clique nas fotos para selecioná-las. A ordem de clique define a ordem no carrossel.
              </p>
              <div className="ig-carousel-grid">
                {photos.map((photo) => {
                  const selIdx = selectedPhotos.indexOf(photo.id);
                  const isSelected = selIdx !== -1;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      className={`ig-carousel-item${isSelected ? ' selected' : ''}`}
                      onClick={() => togglePhotoSelection(photo.id)}
                      title={photo.description || photo.original_name || `Foto ${photo.id}`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.description || photo.original_name || ''}
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="ig-carousel-order" aria-label={`Posição ${selIdx + 1}`}>
                          {selIdx + 1}
                        </div>
                      )}
                      {!isSelected && selectedPhotos.length >= 10 && (
                        <div className="ig-carousel-disabled-overlay" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Legenda</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Escreva a legenda do post..."
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>
                  Primeiro comentário{' '}
                  <span className="text-xs text-muted">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  placeholder="#hashtags ou texto do primeiro comentário"
                />
              </div>

              {selectedPhotos.length > 0 && selectedPhotos.length < 2 && (
                <div className="alert alert-warning" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                  Selecione pelo menos 2 fotos para publicar o carrossel.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={handlePublish}
                  disabled={!canPublish}
                >
                  {publishing ? 'Publicando...' : `Publicar carrossel${selectedPhotos.length >= 2 ? ` (${selectedPhotos.length} fotos)` : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cofre de Chaves ─────────────────────────────────────────────────────────

function SecretSlot({ clientId, slot, onUpdated }) {
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    setMsg('');
    try {
      const updated = await api(`/api/clients/${clientId}/secrets/${slot.name}`, {
        method: 'PUT',
        body: JSON.stringify({ value: value.trim() }),
      });
      setValue('');
      setShowInput(false);
      setMsg('');
      onUpdated(updated);
    } catch (err) {
      if (err.status === 403) {
        setMsg('Apenas administradores podem alterar o cofre.');
      } else {
        setMsg(err.message || 'Erro ao salvar.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir a chave "${slot.label}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    setMsg('');
    try {
      await api(`/api/clients/${clientId}/secrets/${slot.name}`, { method: 'DELETE' });
      onUpdated({ ...slot, configured: false, masked: null, updated_at: null });
    } catch (err) {
      if (err.status === 403) {
        setMsg('Apenas administradores podem alterar o cofre.');
      } else {
        setMsg(err.message || 'Erro ao excluir.');
      }
    } finally {
      setDeleting(false);
    }
  }

  const updatedAt = slot.updated_at
    ? new Date(slot.updated_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="secret-slot-card">
      <div className="secret-slot-header">
        <div className="secret-slot-info">
          <span className="secret-slot-label">{slot.label}</span>
          {slot.configured ? (
            <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>
              ✓ Configurada {slot.masked ? <span className="secret-masked">{slot.masked}</span> : ''}
            </span>
          ) : (
            <span className="badge badge-gray" style={{ fontSize: '0.72rem' }}>Não configurada</span>
          )}
          {updatedAt && (
            <span className="text-xs text-muted">Atualizada em {updatedAt}</span>
          )}
        </div>
        <div className="secret-slot-actions">
          {slot.configured && !showInput && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowInput(true); setMsg(''); }}
              >
                Trocar
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '...' : 'Excluir'}
              </button>
            </>
          )}
          {!slot.configured && !showInput && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setShowInput(true); setMsg(''); }}
            >
              Configurar
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.startsWith('Apenas') ? 'alert-warning' : 'alert-error'}`} style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.8rem' }}>
          {msg}
        </div>
      )}

      {showInput && (
        <div className="secret-slot-input-row">
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Cole o valor da chave aqui..."
              style={{ paddingRight: '2.5rem' }}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="btn-icon"
              style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setShowValue((v) => !v)}
              title={showValue ? 'Ocultar' : 'Mostrar'}
            >
              {showValue ? '🙈' : '👁'}
            </button>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !value.trim()}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setShowInput(false); setValue(''); setMsg(''); }}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

function CofreTab({ clientId }) {
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSecrets();
  }, [clientId]);

  async function loadSecrets() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/clients/${clientId}/secrets`);
      setSecrets(data);
    } catch (err) {
      if (err.status === 403) {
        setError('Apenas administradores podem acessar o cofre.');
      } else {
        setError(err.message || 'Erro ao carregar cofre.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleUpdated(updated) {
    setSecrets((prev) =>
      prev.map((s) => (s.name === updated.name ? { ...s, ...updated } : s))
    );
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <span className="card-title">🔒 Cofre de Chaves de API</span>
        </div>
        <div className="card-body">
          <div className="alert alert-info" style={{ marginBottom: '1.25rem', fontSize: '0.8rem' }}>
            Visível apenas para administradores. Os valores são criptografados e nunca exibidos em texto puro.
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {!error && secrets.length === 0 && (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <p>Nenhum slot disponível.</p>
            </div>
          )}

          {secrets.map((slot) => (
            <SecretSlot
              key={slot.name}
              clientId={clientId}
              slot={slot}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('contrato');
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Contract
  const [contractSaving, setContractSaving] = useState(false);
  const [contractMsg, setContractMsg] = useState('');
  const [contract, setContract] = useState(null);

  // Client edit
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Media
  const [media, setMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();

  // Campaigns
  const [campaigns, setCampaigns] = useState([]);
  const [campsLoading, setCampsLoading] = useState(false);
  const [campsError, setCampsError] = useState('');
  const [creatingCamp, setCreatingCamp] = useState(false);

  useEffect(() => {
    loadClient();
  }, [id]);

  useEffect(() => {
    if (tab === 'midia') loadMedia();
    if (tab === 'campanhas') loadCampaigns();
    // instagram tab mounts its own component which handles loading
  }, [tab]);

  async function loadClient() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/clients/${id}`);
      setClient(data);
      setContract({ ...data.contract });
    } catch (err) {
      setError(err.message || 'Erro ao carregar cliente');
    } finally {
      setLoading(false);
    }
  }

  async function loadMedia() {
    setMediaLoading(true);
    setMediaError('');
    try {
      const data = await api(`/api/clients/${id}/media`);
      setMedia(data);
    } catch (err) {
      setMediaError(err.message || 'Erro ao carregar mídias');
    } finally {
      setMediaLoading(false);
    }
  }

  async function loadCampaigns() {
    setCampsLoading(true);
    setCampsError('');
    try {
      const data = await api(`/api/clients/${id}/campaigns`);
      setCampaigns(data);
    } catch (err) {
      setCampsError(err.message || 'Erro ao carregar campanhas');
    } finally {
      setCampsLoading(false);
    }
  }

  async function saveContract(e) {
    e.preventDefault();
    setContractSaving(true);
    setContractMsg('');
    try {
      const updated = await api(`/api/clients/${id}/contract`, {
        method: 'PUT',
        body: JSON.stringify({
          integration_mode: contract.integration_mode,
          ai_provider: contract.ai_provider,
          auto_post_when_approved: contract.auto_post_when_approved,
          posts_per_day_limit: Number(contract.posts_per_day_limit),
        }),
      });
      setContractMsg('Contrato atualizado com sucesso!');
      setClient((prev) => ({ ...prev, contract: updated }));
      setTimeout(() => setContractMsg(''), 3000);
    } catch (err) {
      setContractMsg('Erro: ' + (err.message || 'Falha ao salvar'));
    } finally {
      setContractSaving(false);
    }
  }

  function setC(key, val) {
    setContract((prev) => ({ ...prev, [key]: val }));
  }

  async function handleEditClient(payload) {
    setEditLoading(true);
    setEditError('');
    try {
      const { contract: _c, ...patchData } = payload;
      await api(`/api/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patchData),
      });
      setShowEditModal(false);
      loadClient();
    } catch (err) {
      setEditError(err.message || 'Erro ao atualizar cliente');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileInputRef.current?.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (uploadDesc) formData.append('description', uploadDesc);
    if (uploadTags) formData.append('tags', uploadTags);

    setUploading(true);
    setMediaError('');
    try {
      const asset = await api(`/api/clients/${id}/media`, {
        method: 'POST',
        body: formData,
      });
      setMedia((prev) => [asset, ...prev]);
      setUploadDesc('');
      setUploadTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setMediaError(err.message || 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  }

  async function deleteMedia(mediaId) {
    if (!confirm('Excluir esta mídia?')) return;
    try {
      await api(`/api/clients/${id}/media/${mediaId}`, { method: 'DELETE' });
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } catch (err) {
      alert(err.message || 'Erro ao excluir mídia');
    }
  }

  async function createCampaign() {
    setCreatingCamp(true);
    try {
      const camp = await api(`/api/clients/${id}/campaigns`, { method: 'POST' });
      navigate(`/campaigns/${camp.id}`);
    } catch (err) {
      alert(err.message || 'Erro ao criar campanha');
      setCreatingCamp(false);
    }
  }

  async function deleteClient() {
    if (!confirm(`Excluir o cliente "${client?.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api(`/api/clients/${id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      alert(err.message || 'Erro ao excluir cliente');
    }
  }

  if (loading) return <Spinner />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!client) return null;

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>
            <Link to="/">Clientes</Link> / {client.name}
          </div>
          <h1 className="page-title">{client.name}</h1>
          {client.instagram_handle && (
            <p className="page-subtitle">@{client.instagram_handle}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(true)}>
            Editar
          </button>
          <button className="btn btn-danger btn-sm" onClick={deleteClient}>
            Excluir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* === CONTRATO === */}
      {tab === 'contrato' && contract && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Configurações de contrato e integração</span>
          </div>
          <div className="card-body">
            <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>
              O administrador escolhe e pode alterar o modo de integração e provedor de IA a qualquer momento.
              As chaves de API ficam protegidas na aba <strong>🔒 Cofre</strong>.
            </div>
            {contractMsg && (
              <div className={`alert ${contractMsg.startsWith('Erro') ? 'alert-error' : 'alert-success'}`}>
                {contractMsg}
              </div>
            )}
            <form onSubmit={saveContract}>
              <div className="grid-2">
                <div className="form-group">
                  <label>Modo de integração</label>
                  <select
                    value={contract.integration_mode}
                    onChange={(e) => setC('integration_mode', e.target.value)}
                  >
                    <option value="mock">Mock (simulação)</option>
                    <option value="instagram_graph">Instagram Graph API</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Provedor de IA</label>
                  <select
                    value={contract.ai_provider}
                    onChange={(e) => setC('ai_provider', e.target.value)}
                  >
                    <option value="mock">Mock (simulação)</option>
                    <option value="claude">Claude (Anthropic)</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label>Limite de posts por dia</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={contract.posts_per_day_limit || 1}
                    onChange={(e) => setC('posts_per_day_limit', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.35rem' }}>
                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={!!contract.auto_post_when_approved}
                      onChange={(e) => setC('auto_post_when_approved', e.target.checked)}
                    />
                    Publicar automaticamente ao aprovar
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={contractSaving}>
                  {contractSaving ? 'Salvando...' : 'Salvar contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === COFRE === */}
      {tab === 'cofre' && (
        <CofreTab clientId={id} />
      )}

      {/* === MÍDIA === */}
      {tab === 'midia' && (
        <div>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-header">
              <span className="card-title">Enviar nova mídia</span>
            </div>
            <div className="card-body">
              {mediaError && <div className="alert alert-error">{mediaError}</div>}
              <form onSubmit={handleUpload}>
                <div className="form-group">
                  <label>Arquivo (foto ou vídeo) *</label>
                  <input type="file" ref={fileInputRef} accept="image/*,video/*" required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Descrição</label>
                    <input
                      type="text"
                      value={uploadDesc}
                      onChange={(e) => setUploadDesc(e.target.value)}
                      placeholder="Descrição da mídia"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tags (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={uploadTags}
                      onChange={(e) => setUploadTags(e.target.value)}
                      placeholder="produto, lifestyle, verão"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? 'Enviando...' : 'Enviar mídia'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {mediaLoading ? (
            <Spinner />
          ) : media.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🖼️</div>
              <p>Nenhuma mídia cadastrada ainda. Envie fotos ou vídeos acima.</p>
            </div>
          ) : (
            <div className="media-grid">
              {media.map((m) => (
                <div key={m.id} className="media-grid-item">
                  <div className="media-thumb">
                    {m.media_type === 'video' ? (
                      <video src={m.url} muted playsInline />
                    ) : (
                      <img src={m.url} alt={m.description || m.original_name} loading="lazy" />
                    )}
                    <div className="media-thumb-overlay">
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteMedia(m.id)}
                        title="Excluir"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="media-label" title={m.original_name}>
                    {m.description || m.original_name}
                  </div>
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex gap-1" style={{ marginTop: '0.2rem', flexWrap: 'wrap' }}>
                      {(Array.isArray(m.tags) ? m.tags : m.tags.split(',')).map((tag) => (
                        <span key={tag} className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === CAMPANHAS === */}
      {tab === 'campanhas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={createCampaign} disabled={creatingCamp}>
              {creatingCamp ? 'Criando...' : '▶ Iniciar atendimento'}
            </button>
          </div>

          {campsError && <div className="alert alert-error">{campsError}</div>}

          {campsLoading ? (
            <Spinner />
          ) : campaigns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p>Nenhuma campanha iniciada ainda.</p>
            </div>
          ) : (
            <div className="card">
              <div className="card-body" style={{ padding: '0.5rem 1.25rem' }}>
                {campaigns.map((camp) => (
                  <div key={camp.id} className="campaign-row">
                    <div>
                      <div className="font-semibold text-sm">
                        Campanha #{camp.id.slice(0, 8)}...
                      </div>
                      <div className="text-xs text-muted" style={{ marginTop: '0.1rem' }}>
                        {camp.created_at
                          ? new Date(camp.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={camp.status} />
                      <Link to={`/campaigns/${camp.id}`} className="btn btn-ghost btn-sm">
                        Abrir
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === INSTAGRAM === */}
      {tab === 'instagram' && (
        <InstagramTab clientId={id} />
      )}

      {/* Edit modal */}
      {showEditModal && (
        <Modal title="Editar cliente" onClose={() => { setShowEditModal(false); setEditError(''); }}>
          <ClientForm
            initial={client}
            onSubmit={handleEditClient}
            loading={editLoading}
            error={editError}
          />
        </Modal>
      )}
    </>
  );
}
