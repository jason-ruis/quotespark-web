import { useState } from 'react';
import './Login.css';

// Password is set via VITE_PASSWORD environment variable (baked in at build time).
// For local dev, create a .env.local file with: VITE_PASSWORD=yourpassword
// For GitHub Actions, add VITE_PASSWORD as a repository secret.
const CORRECT_PASSWORD = import.meta.env.VITE_PASSWORD as string | undefined;

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setError('');

    if (!CORRECT_PASSWORD) {
      setError('Password not configured. Set VITE_PASSWORD in .env.local');
      setIsChecking(false);
      return;
    }

    if (password === CORRECT_PASSWORD) {
      localStorage.setItem('quotespark_auth', 'true');
      onLogin();
    } else {
      setError('Incorrect password');
      setPassword('');
    }

    setIsChecking(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>QuoteSpark</h1>
        <p className="login-subtitle">Enter password to continue</p>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="login-input"
            autoFocus
            disabled={isChecking}
          />

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="login-button"
            disabled={isChecking || !password}
          >
            {isChecking ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
