import { useState } from 'react';

const DEFAULT_CONTRACT = {
  integration_mode: 'mock',
  ai_provider: 'mock',
  auto_post_when_approved: false,
  posts_per_day_limit: 1,
};

export default function ClientForm({ initial, onSubmit, loading, error }) {
  const [name, setName] = useState(initial?.name || '');
  const [handle, setHandle] = useState(initial?.instagram_handle || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [bio, setBio] = useState(initial?.bio || '');
  const [themes, setThemes] = useState((initial?.themes || []).join(', '));
  const [contract, setContract] = useState({
    ...DEFAULT_CONTRACT,
    ...(initial?.contract || {}),
  });

  function setC(key, val) {
    setContract((prev) => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const themesArr = themes
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name,
      instagram_handle: handle,
      email,
      bio,
      themes: themesArr,
      contract: {
        integration_mode: contract.integration_mode,
        ai_provider: contract.ai_provider,
        auto_post_when_approved: contract.auto_post_when_approved,
        posts_per_day_limit: Number(contract.posts_per_day_limit),
      },
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <fieldset style={{ border: 'none', marginBottom: '1.25rem', padding: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gray-700)', marginBottom: '0.75rem' }}>
          Dados do cliente
        </legend>

        <div className="form-group">
          <label>Nome *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente"
            required
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>@ Instagram</label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@handle"
            />
          </div>
          <div className="form-group">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Breve descrição do cliente / perfil"
          />
        </div>

        <div className="form-group">
          <label>Temas (separados por vírgula)</label>
          <input
            type="text"
            value={themes}
            onChange={(e) => setThemes(e.target.value)}
            placeholder="moda, beleza, lifestyle"
          />
          {themes && (
            <div className="tags-input-preview">
              {themes.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                <span key={t} className="badge badge-blue">{t}</span>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <legend style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gray-700)', padding: '0 0.5rem' }}>
          Contrato de integração
          <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--gray-500)', marginLeft: '0.5rem' }}>
            (o administrador escolhe e pode alterar a qualquer momento)
          </span>
        </legend>

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
              value={contract.posts_per_day_limit}
              onChange={(e) => setC('posts_per_day_limit', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.2rem' }}>
            <label className="checkbox-group">
              <input
                type="checkbox"
                checked={contract.auto_post_when_approved}
                onChange={(e) => setC('auto_post_when_approved', e.target.checked)}
              />
              Publicar automaticamente ao aprovar
            </label>
          </div>
        </div>

        <div className="alert alert-info" style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.8rem' }}>
          🔒 As chaves de API são configuradas com segurança no Cofre, após criar o cliente.
        </div>
      </fieldset>

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar cliente'}
        </button>
      </div>
    </form>
  );
}
