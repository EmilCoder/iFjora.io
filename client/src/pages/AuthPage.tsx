import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type AuthMode = "login" | "register";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type AuthResponse = {
  id: number;
  email: string;
  token: string;
  isAdmin?: boolean;
};

type ErrorResponse = {
  message?: string;
};

type AuthPageProps = {
  onAuthSuccess?: (token: string) => void;
};

function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [stayLogged, setStayLogged] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"idle" | "success" | "error" | "info">("idle");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const qp = searchParams.get("mode");
    if (qp === "login" || qp === "register") {
      setMode(qp);
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (mode === "register" && password !== confirmPassword) {
      setStatus("Passordene matcher ikke.");
      setStatusType("error");
      return;
    }

    if (email !== "admin@admin.com" && password.length < 8) {
      setStatus("Passord må være minst 8 tegn.");
      setStatusType("error");
      return;
    }

    setStatus("Sender...");
    setStatusType("info");

    try {
      const res = await fetch(`${API_URL}/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const error = (await res.json()) as ErrorResponse;
        setStatus(error.message ?? "Noe gikk galt.");
        setStatusType("error");
        return;
      }

      const data = (await res.json()) as AuthResponse;
      localStorage.setItem("token", data.token);
      if (data.isAdmin) {
        localStorage.setItem("isAdmin", "1");
      } else {
        localStorage.removeItem("isAdmin");
      }
      onAuthSuccess?.(data.token);
      setStatus(
        `${mode === "register" ? "Registrert" : "Logget inn"} som ${
          data.email
        }. Token er lagret i nettleseren.`
      );
      setStatusType("success");
    } catch (err) {
      setStatus("Klarte ikke å kontakte serveren.");
      setStatusType("error");
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <h1>{mode === "login" ? "Logg inn" : "Registrer deg"}</h1>
        <form className="auth-form auth-form-styled" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="auth-email">E-postadresse</label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="navn@firma.no"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Passord</label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={email === "admin@admin.com" ? undefined : 8}
              required
              placeholder="••••••••"
            />
          </div>

          {mode === "register" && (
            <div className="auth-field">
              <label htmlFor="auth-password-confirm">Bekreft passord</label>
              <input
                id="auth-password-confirm"
                className="auth-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                placeholder="••••••••"
              />
            </div>
          )}

          <label className="auth-remember">
            <input
              type="checkbox"
              checked={stayLogged}
              onChange={(e) => setStayLogged(e.target.checked)}
            />
            <span>Forbli innlogget</span>
          </label>

          <button className="auth-submit" type="submit">
            {mode === "register" ? "Registrer deg" : "Logg inn"}
          </button>
        </form>

        <p className="auth-switch-text">
          {mode === "login" ? "Har du ikke konto?" : "Har du allerede konto?"}{" "}
          <button
            type="button"
            className="auth-text-link"
            onClick={() => {
              const next = mode === "login" ? "register" : "login";
              setMode(next);
              setSearchParams({ mode: next });
            }}
          >
            {mode === "login" ? "Registrer deg" : "Logg inn"}
          </button>
        </p>

        {status && (
          <div className={`status-banner status-${statusType}`}>{status}</div>
        )}
      </section>
    </div>
  );
}

export default AuthPage;
