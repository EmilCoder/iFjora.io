import { FormEvent, useEffect, useState } from "react";

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
    <section className="page">
      <h1>Profil / Min side</h1>
      <p>Oppdater e-post og eventuelt passord.</p>
      <form className="auth-form" onSubmit={handleUpdate}>
        <label>
          E-post
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Nytt passord (valgfritt)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            placeholder="La stå tomt for å beholde nåværende"
          />
        </label>
        <button type="submit">Lagre endringer</button>
      </form>
      {status && <p className="status">{status}</p>}
    </section>
  );
}

export default ProfilePage;
