import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, apiLogin, setToken } from '../api.js';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      // Auto-login after register
      const data = await apiLogin(email, password);
      setToken(data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-icon-wrap">✂</div>
          <h1>Criar conta</h1>
          <p>Recorte Eletrônico</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
            />
          </div>
          <div className="form-group">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ marginTop: '0.5rem', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </form>

        <hr className="divider" />
        <p className="text-sm text-center text-muted">
          Já tem conta?{' '}
          <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
