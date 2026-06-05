import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatFollowers } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

// ─── helpers ────────────────────────────────────────────────────────────────

function stepFor(campaign) {
  const s = campaign?.status;
  if (!s || s === 'created') return 1;
  if (s === 'analyzing') return 1;
  if (s === 'topics_ready') return 2;
  if (s === 'draft_generated' || s === 'pending_approval') return 3;
  if (s === 'approved' || s === 'posted' || s === 'completed') return 4;
  if (s === 'paused_until') return 'paused';
  return 1;
}

function EngagementBar({ score }) {
  // score 0–100
  const pct = Math.min(100, Math.max(0, score || 0));
  return (
    <div className="engagement-bar" title={`Engajamento: ${pct}`}>
      <div className="engagement-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SourceBadge({ source }) {
  if (source === 'instagram') return <span className="badge badge-blue">📸 Instagram</span>;
  if (source === 'internet') return <span className="badge badge-gray">🌐 Internet</span>;
  return <span className="badge badge-gray">{source}</span>;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Campaign() {
  const { id } = useParams();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Step 1 - analyze
  const [analyzing, setAnalyzing] = useState(false);

  // Step 2 - select topic
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState('auto'); // 'auto' | media_id
  const [clientMedia, setClientMedia] = useState([]);
  const [selectingTopic, setSelectingTopic] = useState(false);
  const [draft, setDraft] = useState(null);

  // Step 3 - review
  const [reviewing, setReviewing] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');

  // Edição de vídeo (Remotion)
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoMsg, setVideoMsg] = useState('');

  // Reject flow
  const [showRejectOptions, setShowRejectOptions] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectResult, setRejectResult] = useState(null);

  useEffect(() => {
    loadCampaign();
  }, [id]);

  async function loadCampaign() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/campaigns/${id}`);
      setCampaign(data);
      // Load existing draft if any
      if (data.drafts && data.drafts.length > 0) {
        const latestDraft = data.drafts[data.drafts.length - 1];
        setDraft(latestDraft);
      }
      // Pre-select topic if already selected
      if (data.selected_topic_id) {
        setSelectedTopic(data.selected_topic_id);
      }
      // Load client media
      if (data.client_id) {
        loadClientMedia(data.client_id);
      }
    } catch (err) {
      setError(err.message || 'Erro ao carregar campanha');
    } finally {
      setLoading(false);
    }
  }

  async function loadClientMedia(clientId) {
    try {
      const data = await api(`/api/clients/${clientId}/media`);
      setClientMedia(data);
    } catch {
      // ignore
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      const data = await api(`/api/campaigns/${id}/analyze`, { method: 'POST' });
      setCampaign(data);
    } catch (err) {
      setError(err.message || 'Erro ao analisar perfil');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSelectTopic(topicId) {
    setSelectingTopic(true);
    setError('');
    setDraft(null);
    try {
      const payload = { topic_id: topicId };
      if (selectedMedia !== 'auto') payload.media_asset_id = selectedMedia;
      const newDraft = await api(`/api/campaigns/${id}/select-topic`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setDraft(newDraft);
      setSelectedTopic(topicId);
      // Refresh campaign to get updated status
      const updated = await api(`/api/campaigns/${id}`);
      setCampaign(updated);
    } catch (err) {
      setError(err.message || 'Erro ao gerar draft');
    } finally {
      setSelectingTopic(false);
    }
  }

  async function handleApprove() {
    if (!draft) return;
    setReviewing(true);
    setReviewMsg('');
    try {
      const updated = await api(`/api/drafts/${draft.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approved: true }),
      });
      setDraft(updated);
      // Refresh campaign
      const updatedCamp = await api(`/api/campaigns/${id}`);
      setCampaign(updatedCamp);
      setReviewMsg('Post aprovado com sucesso!');
    } catch (err) {
      setReviewMsg('Erro: ' + (err.message || 'Falha ao aprovar'));
    } finally {
      setReviewing(false);
    }
  }

  async function handleRenderVideo() {
    if (!draft) return;
    setRendering(true);
    setVideoMsg('');
    try {
      const result = await api(`/api/drafts/${draft.id}/render-video`, { method: 'POST' });
      if (result.ok) {
        setVideoUrl(result.url);
        setVideoMsg('Vídeo montado com sucesso!');
      } else {
        setVideoMsg('Não foi possível renderizar: ' + (result.detail || 'erro desconhecido'));
      }
    } catch (err) {
      setVideoMsg('Erro: ' + (err.message || 'Falha ao renderizar o vídeo'));
    } finally {
      setRendering(false);
    }
  }

  async function handlePublish() {
    if (!draft) return;
    setReviewing(true);
    setReviewMsg('');
    try {
      const updated = await api(`/api/drafts/${draft.id}/publish`, { method: 'POST' });
      setDraft(updated);
      const updatedCamp = await api(`/api/campaigns/${id}`);
      setCampaign(updatedCamp);
      setReviewMsg('Post publicado com sucesso!');
    } catch (err) {
      setReviewMsg('Erro: ' + (err.message || 'Falha ao publicar'));
    } finally {
      setReviewing(false);
    }
  }

  async function handleReject(decision, topicId = null) {
    if (!draft) return;
    setRejecting(true);
    setRejectResult(null);
    try {
      const payload = { decision, feedback: rejectFeedback || undefined };
      if (topicId) payload.topic_id = topicId;
      const result = await api(`/api/drafts/${draft.id}/reject`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setRejectResult(result);
      setShowRejectOptions(false);

      if (decision === 'redo_post') {
        // A new draft was generated
        await loadCampaign();
      } else if (decision === 'select_other_topic') {
        // Reload — new draft generated with different topic
        await loadCampaign();
      } else if (decision === 'pause') {
        // Campaign paused
        const updatedCamp = await api(`/api/campaigns/${id}`);
        setCampaign(updatedCamp);
      }
    } catch (err) {
      setError(err.message || 'Erro ao reprovar post');
    } finally {
      setRejecting(false);
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  function renderStep(num, label, status) {
    // status: 'active' | 'done' | 'pending'
    return (
      <div className={`step ${status}`}>
        <div className="step-num">{status === 'done' ? '✓' : num}</div>
        <span className="step-label">{label}</span>
      </div>
    );
  }

  function renderSteps() {
    const step = stepFor(campaign);
    return (
      <div className="step-indicator">
        {renderStep(1, 'Analisar', step > 1 ? 'done' : step === 1 ? 'active' : 'pending')}
        <div className={`step-sep ${step > 1 ? 'done' : ''}`} />
        {renderStep(2, 'Selecionar assunto', step > 2 ? 'done' : step === 2 ? 'active' : 'pending')}
        <div className={`step-sep ${step > 2 ? 'done' : ''}`} />
        {renderStep(3, 'Revisar post', step > 3 ? 'done' : step === 3 ? 'active' : 'pending')}
        <div className={`step-sep ${step > 3 ? 'done' : ''}`} />
        {renderStep(4, 'Publicado', step === 4 ? 'active' : 'pending')}
      </div>
    );
  }

  function renderMediaPreview(mediaId) {
    if (!mediaId) return null;
    const asset = clientMedia.find((m) => m.id === mediaId);
    if (!asset) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>📷</div>;
    if (asset.media_type === 'video') {
      return <video src={asset.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    return <img src={asset.url} alt={asset.description || asset.original_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loading) return <Spinner />;
  if (error && !campaign) return <div className="alert alert-error">{error}</div>;
  if (!campaign) return null;

  const step = stepFor(campaign);
  const isPaused = campaign.status === 'paused_until';
  const topics = campaign.topics || [];
  const competitors = campaign.competitors || [];
  const topicsReady = ['topics_ready', 'draft_generated', 'pending_approval', 'approved', 'posted', 'completed'].includes(campaign.status);

  return (
    <>
      {/* Breadcrumb & header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>
            <Link to="/">Clientes</Link>
            {campaign.client_id && (
              <> / <Link to={`/clients/${campaign.client_id}`}>Cliente</Link></>
            )}
            {' / '}Campanha
          </div>
          <h1 className="page-title">
            Campanha #{id.slice(0, 8)}...
          </h1>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {renderSteps()}

      {error && <div className="alert alert-error">{error}</div>}
      {reviewMsg && (
        <div className={`alert ${reviewMsg.startsWith('Erro') ? 'alert-error' : 'alert-success'}`}>
          {reviewMsg}
        </div>
      )}

      {/* === PAUSED === */}
      {isPaused && (
        <div className="pause-banner" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏸️</div>
          <div className="pause-banner-title">Atendimento pausado</div>
          <div className="pause-banner-sub">
            {campaign.next_resume_date
              ? `Retoma em: ${new Date(campaign.next_resume_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
              : 'Retomará em breve'}
          </div>
        </div>
      )}

      {/* === STEP 1: Analyze === */}
      {step === 1 && !isPaused && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔍</div>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.2rem', fontWeight: 700 }}>
              Analisar perfil e buscar tendências
            </h2>
            <p className="text-muted text-sm" style={{ marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
              O sistema vai analisar o perfil do cliente, identificar concorrentes e buscar os melhores assuntos para o post.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />
                  Analisando...
                </>
              ) : (
                '▶ Analisar perfil e buscar tendências'
              )}
            </button>
          </div>
        </div>
      )}

      {/* === After analysis: summary + competitors + topics === */}
      {topicsReady && (
        <>
          {/* Analysis summary */}
          {campaign.analysis_summary && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="section-title">📊 Resumo da análise</div>
              <div className="analysis-block">{campaign.analysis_summary}</div>
            </div>
          )}

          {campaign.detected_themes && campaign.detected_themes.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="section-title">🏷️ Temas detectados</div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {campaign.detected_themes.map((t) => (
                  <span key={t} className="badge badge-blue">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Competitors */}
          {competitors.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="section-title">👥 Concorrentes</div>
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>@Handle</th>
                        <th className="num">Seguidores</th>
                        <th className="num">Relevância</th>
                        <th>Temas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...competitors]
                        .sort((a, b) => (b.followers || 0) - (a.followers || 0))
                        .map((c) => (
                          <tr key={c.id || c.handle}>
                            <td><strong>@{c.handle}</strong></td>
                            <td className="num">{formatFollowers(c.followers)}</td>
                            <td className="num">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 120, justifyContent: 'flex-end' }}>
                                <EngagementBar score={c.relevance} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', flexShrink: 0 }}>
                                  {c.relevance ?? '—'}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                                {(c.themes || []).slice(0, 3).map((t) => (
                                  <span key={t} className="badge badge-gray">{t}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Topics */}
          {topics.length > 0 && step === 2 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="section-title">💡 Selecione um assunto para o post</div>

              {/* Media picker */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="card-header">
                  <span className="card-title">Escolha uma mídia (opcional)</span>
                </div>
                <div className="card-body">
                  <p className="text-sm text-muted" style={{ marginBottom: '0.75rem' }}>
                    Se não escolher, o sistema selecionará automaticamente.
                  </p>
                  <div className="media-selector-grid">
                    <div
                      className={`media-selector-none ${selectedMedia === 'auto' ? 'selected' : ''}`}
                      onClick={() => setSelectedMedia('auto')}
                    >
                      🤖 Auto
                    </div>
                    {clientMedia.map((m) => (
                      <div
                        key={m.id}
                        className={`media-selector-item ${selectedMedia === m.id ? 'selected' : ''}`}
                        onClick={() => setSelectedMedia(m.id)}
                        title={m.description || m.original_name}
                      >
                        {m.media_type === 'video' ? (
                          <video src={m.url} muted />
                        ) : (
                          <img src={m.url} alt={m.original_name} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid-2">
                {topics.map((t) => (
                  <div
                    key={t.id}
                    className={`topic-card ${selectedTopic === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTopic(t.id)}
                  >
                    <div className="topic-card-title">{t.title}</div>
                    <div className="topic-card-desc">{t.description}</div>
                    <div className="topic-card-meta">
                      <SourceBadge source={t.source} />
                      {t.engagement_score != null && (
                        <span>Engajamento: {t.engagement_score}</span>
                      )}
                      {(t.related_handles || []).length > 0 && (
                        <span>{t.related_handles.slice(0, 2).map((h) => `@${h}`).join(', ')}</span>
                      )}
                    </div>
                    <EngagementBar score={t.engagement_score} />
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        className={`btn btn-sm ${selectedTopic === t.id ? 'btn-primary' : 'btn-ghost'}`}
                        disabled={selectingTopic}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTopic(t.id);
                        }}
                      >
                        {selectingTopic && selectedTopic === t.id ? 'Gerando...' : 'Selecionar este assunto'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show topics again when in step 3 for "choose other" flow */}
          {topics.length > 0 && step === 3 && rejectResult?.action === 'select_other_topic' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="section-title">💡 Escolha outro assunto</div>
              <div className="grid-2">
                {topics.map((t) => (
                  <div
                    key={t.id}
                    className={`topic-card ${selectedTopic === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTopic(t.id)}
                  >
                    <div className="topic-card-title">{t.title}</div>
                    <div className="topic-card-desc">{t.description}</div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        className={`btn btn-sm btn-primary`}
                        disabled={selectingTopic}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTopic(t.id);
                        }}
                      >
                        {selectingTopic ? 'Gerando...' : 'Gerar post com este assunto'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* === STEP 3: Draft review === */}
      {draft && (draft.status === 'pending_approval' || draft.status === 'draft_generated') && !showRejectOptions && !rejectResult && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">
            📝 Post gerado
            <span className="version-badge">v{draft.version || 1}</span>
          </div>
          <div className="post-preview">
            <div className="post-preview-media">
              {draft.media_asset_id
                ? renderMediaPreview(draft.media_asset_id)
                : <span>📷</span>
              }
            </div>
            <div className="post-preview-body">
              <div className="post-preview-caption">{draft.caption}</div>
              {draft.hashtags && (
                <div className="post-preview-hashtags">{draft.hashtags}</div>
              )}
              {draft.first_comment && (
                <div className="post-preview-comment">
                  Primeiro comentário: {draft.first_comment}
                </div>
              )}
              {draft.call_to_action && (
                <div className="post-preview-comment">
                  CTA: {draft.call_to_action}
                </div>
              )}
            </div>
          </div>

          {(videoUrl || draft.rendered_video_url) && (
            <div className="rendered-video">
              <div className="rendered-video-title">🎬 Reel montado (Remotion)</div>
              <video
                src={videoUrl || draft.rendered_video_url}
                controls
                playsInline
                className="rendered-video-player"
              />
            </div>
          )}
          {videoMsg && (
            <div className={`alert ${videoMsg.startsWith('Erro') || videoMsg.startsWith('Não') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '1rem' }}>
              {videoMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleRenderVideo}
              disabled={rendering || reviewing}
            >
              {rendering ? 'Montando vídeo...' : '🎬 Gerar vídeo'}
            </button>
            <button
              className="btn btn-success btn-lg"
              onClick={handleApprove}
              disabled={reviewing}
            >
              {reviewing ? 'Aprovando...' : '✓ Aprovar e postar'}
            </button>
            <button
              className="btn btn-danger btn-lg"
              onClick={() => setShowRejectOptions(true)}
              disabled={reviewing}
            >
              ✕ Reprovar
            </button>
          </div>
        </div>
      )}

      {/* Approved but not auto-posted */}
      {draft && draft.status === 'approved' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="alert alert-success">
            Post aprovado! Clique em "Publicar agora" para enviar ao Instagram, ou aguarde a publicação automática.
          </div>
          <div className="post-preview" style={{ marginBottom: '1rem' }}>
            <div className="post-preview-media">
              {draft.media_asset_id ? renderMediaPreview(draft.media_asset_id) : <span>📷</span>}
            </div>
            <div className="post-preview-body">
              <div className="post-preview-caption">{draft.caption}</div>
              {draft.hashtags && <div className="post-preview-hashtags">{draft.hashtags}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={handlePublish} disabled={reviewing}>
              {reviewing ? 'Publicando...' : '🚀 Publicar agora'}
            </button>
          </div>
        </div>
      )}

      {/* Posted */}
      {draft && draft.status === 'posted' && (
        <div className="success-banner" style={{ marginBottom: '1.5rem' }}>
          <div className="success-banner-icon">🎉</div>
          <div className="success-banner-title">Post publicado com sucesso!</div>
          {draft.external_post_id && (
            <div className="success-banner-sub">
              ID externo: <code>{draft.external_post_id}</code>
            </div>
          )}
          {draft.posted_at && (
            <div className="success-banner-sub">
              Publicado em: {new Date(draft.posted_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}
        </div>
      )}

      {/* === Reject options === */}
      {showRejectOptions && draft && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">Por que deseja reprovar?</span>
            <button className="btn-icon" onClick={() => setShowRejectOptions(false)}>✕</button>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>Feedback (opcional)</label>
              <textarea
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
                placeholder="Explique o que deve ser melhorado..."
                rows={2}
              />
            </div>
            <div className="reject-options">
              <button
                className="reject-option-btn"
                onClick={() => handleReject('redo_post')}
                disabled={rejecting}
              >
                <span className="reject-option-icon">🔄</span>
                <div>
                  <div className="reject-option-label">Refazer post</div>
                  <div className="reject-option-desc">Gerar nova versão do post com o mesmo assunto</div>
                </div>
              </button>

              <button
                className="reject-option-btn"
                onClick={() => {
                  // Show topic list for selection
                  handleReject('select_other_topic');
                }}
                disabled={rejecting || topics.length === 0}
              >
                <span className="reject-option-icon">💡</span>
                <div>
                  <div className="reject-option-label">Escolher outro assunto</div>
                  <div className="reject-option-desc">Voltar para a lista de assuntos e escolher um diferente</div>
                </div>
              </button>

              <button
                className="reject-option-btn"
                onClick={() => handleReject('pause')}
                disabled={rejecting}
                style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
              >
                <span className="reject-option-icon">⏸️</span>
                <div>
                  <div className="reject-option-label">Pausar atendimento (retorna amanhã)</div>
                  <div className="reject-option-desc">Pausar a campanha e retomar no próximo dia útil</div>
                </div>
              </button>
            </div>
            {rejecting && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject result feedback */}
      {rejectResult && rejectResult.action === 'pause' && (
        <div className="pause-banner" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏸️</div>
          <div className="pause-banner-title">Atendimento pausado</div>
          <div className="pause-banner-sub">
            {rejectResult.resume_on
              ? `Retoma em: ${new Date(rejectResult.resume_on).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
              : 'Retomará em breve'}
          </div>
        </div>
      )}
    </>
  );
}
