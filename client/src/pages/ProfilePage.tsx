import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type MeResponse = {
  id: number;
  email: string;
  createdAt?: string;
  updatedAt?: string;
};

type ErrorResponse = {
  message?: string;
};

function ProfilePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const navigate = useNavigate();

  async function fetchMe() {
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("Ingen token funnet. Logg inn først.");
      return;
    }
    setStatus("Henter profil...");
    try {
      const res = await fetch(`${API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Kunne ikke hente profil.");
        return;
      }
      const data = (await res.json()) as MeResponse;
      setEmail(data.email);
      setStatus("");
    } catch {
      setStatus("Klarte ikke å hente profil.");
    }
  }

  useEffect(() => {
    fetchMe();
  }, []);

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("Ingen token funnet. Logg inn først.");
      return;
    }
    setStatus("Lagrer...");
    try {
      const res = await fetch(`${API_URL}/api/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password: password || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Kunne ikke oppdatere profil.");
        return;
      }
      const data = (await res.json()) as MeResponse;
      setEmail(data.email);
      setPassword("");
      setStatus("Profil oppdatert.");
    } catch {
      setStatus("Klarte ikke å oppdatere profil.");
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-card-header">
          <div>
            <p className="eyebrow">Min side</p>
            <h1>Din konto</h1>
            <p className="profile-sub">
              Oppdater e-post og passord. Endringer gjelder kun deg og krever innlogging.
            </p>
          </div>
          <button
            type="button"
            className="profile-nav-btn"
            onClick={() => navigate("/insights")}
          >
            Se innsikt
          </button>
        </div>

        <form className="profile-form" onSubmit={handleUpdate}>
          <div className="profile-field">
            <label>E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="profile-field">
            <label>Nytt passord (valgfritt)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="La stå tomt for å beholde nåværende"
            />
            <small>Minst 8 tegn. Feltet kan stå tomt hvis du ikke vil endre passord.</small>
          </div>
          <div className="profile-actions">
            <button type="submit" className="profile-save">
              Lagre endringer
            </button>
          </div>
        </form>

        {status && <div className="status-banner status-info">{status}</div>}
      </div>
    </div>
  );
}

export default ProfilePage;
