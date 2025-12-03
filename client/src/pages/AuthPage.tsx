import { FormEvent, useState } from "react";

type AuthMode = "login" | "register";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type AuthResponse = {
  id: number;
  email: string;
  token: string;
};

type ErrorResponse = {
  message?: string;
};

type AuthPageProps = {
  onAuthSuccess?: (token: string) => void;
};

function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("Sender...");

    try {
      const res = await fetch(`${API_URL}/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const error = (await res.json()) as ErrorResponse;
        setStatus(error.message ?? "Noe gikk galt.");
        return;
      }

      const data = (await res.json()) as AuthResponse;
      localStorage.setItem("token", data.token);
      onAuthSuccess?.(data.token);
      setStatus(
        `${mode === "register" ? "Registrert" : "Logget inn"} som ${
          data.email
        }. Token er lagret i nettleseren.`
      );
    } catch (err) {
      setStatus("Klarte ikke å kontakte serveren.");
    }
  }

  return (
    <section className="page">
      <h1>Logg inn / Registrer</h1>
      <div className="auth-toggle">
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
          type="button"
        >
          Registrer
        </button>
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
          type="button"
        >
          Logg inn
        </button>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
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
          Passord
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit">
          {mode === "register" ? "Registrer" : "Logg inn"}
        </button>
      </form>

      {status && <p className="status">{status}</p>}
    </section>
  );
}

export default AuthPage;
