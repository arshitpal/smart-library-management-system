import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <h1>Run your library with fewer surprises.</h1>
        <p>Issue books, track due dates and fines, and see the likely fine on a loan before it grows.</p>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <div className="brand p-0 mb-4 text-dark"><span className="brand-mark text-white"><i className="bi bi-book-half" /></span>Smart Library</div>
          <h2 className="fs-4 fw-bold mb-1">Sign in</h2>
          <p className="text-muted small mb-4">Use the account given by your library.</p>
          <Alert>{error}</Alert>
          <div className="mb-3">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="form-control" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="form-control" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {import.meta.env.DEV && (
            <div className="demo-logins">
              <strong>Local test logins</strong><br />
              admin@library.test / Admin@123<br />
              librarian1@library.test / Librarian@123<br />
              student3@library.test / Student@123
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
