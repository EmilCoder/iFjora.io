import { Link, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage";
import IdeaSubmissionPage from "./pages/IdeaSubmissionPage";
import InsightsPage from "./pages/InsightsPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";

function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token")
  );

  useEffect(() => {
    const listener = () => {
      setToken(localStorage.getItem("token"));
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    setToken(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">iFjora</div>
        <nav>
          <Link to="/">Landingsside</Link>
          <Link to="/ideas">Ideinnsending</Link>
          <Link to="/insights">Innsikt</Link>
          {!token && <Link to="/auth">Logg inn / Registrer</Link>}
          {token && <Link to="/profile">Min side</Link>}
          {token && (
            <button className="ghost" type="button" onClick={handleLogout}>
              Logg ut
            </button>
          )}
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/ideas" element={<IdeaSubmissionPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route
            path="/auth"
            element={
              <AuthPage
                onAuthSuccess={(tok) => {
                  setToken(tok);
                }}
              />
            }
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
