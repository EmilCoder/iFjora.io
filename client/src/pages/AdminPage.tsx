import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type AdminUser = {
  id: number;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type AdminIdea = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  userId: number;
  userEmail: string;
  analysis?: {
    score?: number;
    summary?: string;
  };
};

type ErrorResponse = {
  message?: string;
};

function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [ideas, setIdeas] = useState<AdminIdea[]>([]);
  const [status, setStatus] = useState<string>("");
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const isAdmin = localStorage.getItem("isAdmin") === "1";

  async function fetchUsers() {
    if (!token || !isAdmin) {
      setStatus("Du må være innlogget som admin.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Kunne ikke hente brukere.");
        return;
      }
      const data = (await res.json()) as AdminUser[];
      setUsers(data);
      setStatus("");
    } catch {
      setStatus("Klarte ikke å hente brukere.");
    }
  }

  async function fetchIdeas() {
    if (!token || !isAdmin) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/ideas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Kunne ikke hente ideer.");
        return;
      }
      const data = (await res.json()) as AdminIdea[];
      setIdeas(data);
    } catch {
      setStatus("Klarte ikke å hente ideer.");
    }
  }

  useEffect(() => {
    if (!token || !isAdmin) {
      setStatus("Du må være innlogget som admin.");
      return;
    }
    fetchUsers();
    fetchIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteUser(id: number) {
    if (!token || !isAdmin) return;
    if (!confirm("Slett bruker og alle tilknyttede ideer?")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Kunne ikke slette bruker.");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setIdeas((prev) => prev.filter((i) => i.userId !== id));
    } catch {
      setStatus("Klarte ikke å slette bruker.");
    }
  }

  async function deleteIdea(id: number) {
    if (!token || !isAdmin) return;
    if (!confirm("Slett idé?")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/ideas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Kunne ikke slette idé.");
        return;
      }
      setIdeas((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setStatus("Klarte ikke å slette idé.");
    }
  }

  if (!token || !isAdmin) {
    return (
      <div className="admin-page">
        <div className="card">
          <h2>Ingen tilgang</h2>
          <p>Du må logge inn som admin.</p>
          <button className="header-btn solid" onClick={() => navigate("/auth?mode=login")}>
            Gå til innlogging
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Dashboard</h1>
          <p className="profile-sub">Se og administrer brukere og ideer.</p>
        </div>
      </div>

      {status && <div className="status-banner status-info">{status}</div>}

      <div className="admin-grid">
        <div className="card">
          <h3>Brukere</h3>
          <div className="table">
            <div className="table-head">
              <span>ID</span>
              <span>E-post</span>
              <span>Opprettet</span>
              <span></span>
            </div>
            {users.map((u) => (
              <div className="table-row" key={u.id}>
                <span>{u.id}</span>
                <span>{u.email}</span>
                <span>{new Date(u.createdAt).toLocaleDateString("no-NO")}</span>
                <span>
                  <button className="table-delete" onClick={() => deleteUser(u.id)}>
                    Slett
                  </button>
                </span>
              </div>
            ))}
            {users.length === 0 && <p>Ingen brukere.</p>}
          </div>
        </div>

        <div className="card">
          <h3>Ideer</h3>
          <div className="table">
            <div className="table-head">
              <span>ID</span>
              <span>Tittel</span>
              <span>Bruker</span>
              <span></span>
            </div>
            {ideas.map((i) => (
              <div className="table-row" key={i.id}>
                <span>{i.id}</span>
                <span>{i.title}</span>
                <span>
                  {i.userEmail} (#{i.userId})
                </span>
                <span>
                  <button className="table-delete" onClick={() => deleteIdea(i.id)}>
                    Slett
                  </button>
                </span>
              </div>
            ))}
            {ideas.length === 0 && <p>Ingen ideer.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
