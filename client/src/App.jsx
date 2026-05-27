import { useState } from 'react';
import { useAuctionSocket } from './hooks/useAuctionSocket';
import AuctioneerPanel from './components/AuctioneerPanel';
import LiveViewerPanel from './components/LiveViewerPanel';
import AuctioneerLogin, { isAuctioneerAuthenticated } from './components/AuctioneerLogin';
import './App.css';

function getInitialTab() {
  const params = new URLSearchParams(window.location.search);
  return params.get('tab') === 'auctioneer' ? 'auctioneer' : 'viewer';
}

export default function App() {
  const [tab, setTab] = useState(getInitialTab);
  const [auctioneerAuthed, setAuctioneerAuthed] = useState(isAuctioneerAuthenticated);
  const socket = useAuctionSocket();

  const openAuctioneer = () => {
    setTab('auctioneer');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-ipl">IPL</span>
          <span className="brand-title">LIVE AUCTION</span>
        </div>
        <nav className="tab-nav">
          <button
            type="button"
            className={`tab-btn ${tab === 'auctioneer' ? 'active' : ''}`}
            onClick={openAuctioneer}
          >
            Auctioneer Panel
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'viewer' ? 'active' : ''}`}
            onClick={() => setTab('viewer')}
          >
            Live Viewer
          </button>
        </nav>
        <div className={`connection ${socket.connected ? 'on' : 'off'}`}>
          <span className="live-dot" />
          {socket.connected ? 'LIVE' : 'OFFLINE'}
        </div>
      </header>

      {socket.error && (
        <div className="error-banner animate-in" onClick={() => socket.setError(null)}>
          {socket.error}
        </div>
      )}

      <main className="app-main">
        {tab === 'auctioneer' ? (
          auctioneerAuthed ? (
            <AuctioneerPanel {...socket} />
          ) : (
            <AuctioneerLogin onSuccess={() => setAuctioneerAuthed(true)} />
          )
        ) : (
          <LiveViewerPanel auctionState={socket.auctionState} />
        )}
      </main>
    </div>
  );
}
