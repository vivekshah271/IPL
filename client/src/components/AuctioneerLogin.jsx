import { useState } from 'react';
import './AuctioneerLogin.css';

const AUTH_KEY = 'ipl_auctioneer_authenticated';
const USERNAME = 'vivekandprem123';
const PASSWORD = 'vivekandprem123';

export function isAuctioneerAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function setAuctioneerAuthenticated() {
  localStorage.setItem(AUTH_KEY, 'true');
}

export default function AuctioneerLogin({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === USERNAME && password === PASSWORD) {
      setAuctioneerAuthenticated();
      setError('');
      onSuccess();
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="auctioneer-login">
      <div className="login-card animate-in">
        <h2>Auctioneer Access</h2>
        <p>Enter credentials to open the auction control panel.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Password"
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-submit">
            Unlock Panel
          </button>
        </form>
      </div>
    </div>
  );
}
