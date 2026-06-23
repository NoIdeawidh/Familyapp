import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function LandingPage() {
  const navigate = useNavigate();
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="landing">
      <div className="landing-container">
        <div className="landing-hero">
          <div className="landing-badge">Familien-Spielsystem</div>
          <h1>Familien-Reich</h1>
          <p className="landing-subtitle">
            Haushaltsaufgaben werden zum Abenteuer. Erledige Aufgaben, sammle Untertanen,
            erobere Felder und tausche Gold gegen Belohnungen.
          </p>
        </div>

        <div className="landing-actions">
          <Button size="lg" fullWidth onClick={() => navigate('/auth/create-family')}>
            Familie erstellen
          </Button>
          <Button size="lg" variant="secondary" fullWidth onClick={() => navigate('/auth/join-family')}>
            Familie beitreten
          </Button>
          <Button size="lg" variant="ghost" fullWidth onClick={() => navigate('/auth/login')}>
            Anmelden
          </Button>
        </div>

        <button className="landing-info-toggle" onClick={() => setShowInfo(!showInfo)}>
          {showInfo ? 'Weniger erfahren' : 'Wie funktioniert es?'}
        </button>

        {showInfo && (
          <div className="landing-info">
            <div className="info-grid">
              <div className="info-card">
                <span className="info-icon">📋</span>
                <h3>Aufgaben</h3>
                <p>Erledige Haushaltsaufgaben und verdiene Untertanen als Belohnung.</p>
              </div>
              <div className="info-card">
                <span className="info-icon">🗺️</span>
                <h3>Reichskarte</h3>
                <p>Setze Untertanen ein, um Felder auf der Karte zu erobern.</p>
              </div>
              <div className="info-card">
                <span className="info-icon">💰</span>
                <h3>Ressourcen</h3>
                <p>Eigene Felder produzieren Gold und Baumaterial.</p>
              </div>
              <div className="info-card">
                <span className="info-icon">🎁</span>
                <h3>Belohnungen</h3>
                <p>Tausche Gold im Shop gegen echte Familienvorteile.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
