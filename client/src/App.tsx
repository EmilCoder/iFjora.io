import { Link, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage";
import IdeaSubmissionPage from "./pages/IdeaSubmissionPage";
import InsightsPage from "./pages/InsightsPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import logo from "./fjora_logo.png";
import AdminPage from "./pages/AdminPage";

function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token")
  );
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => localStorage.getItem("isAdmin") === "1"
  );

  useEffect(() => {
    const listener = () => {
      setToken(localStorage.getItem("token"));
      setIsAdmin(localStorage.getItem("isAdmin") === "1");
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("isAdmin");
    setToken(null);
    setIsAdmin(false);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <Link to="/" className="brand brand-logo" aria-label="Gå til forsiden">
            <img src={logo} alt="Fjora logo" />
          </Link>
          <nav className="main-nav">
            <Link to="/">Hjem</Link>
            <Link to="/ideas">Ideinnsending</Link>
            <Link to="/insights">Innsikt</Link>
            {isAdmin && <Link to="/admin">Admin</Link>}
          </nav>
        </div>
        <nav className="header-actions">
          {!token && (
            <>
              <Link className="header-btn outline" to="/auth?mode=login">
                Logg inn
              </Link>
              <Link className="header-btn solid" to="/auth?mode=register">
                Registrer deg
              </Link>
            </>
          )}
          {token && (
            <Link className="header-btn solid" to="/profile">
              Min side
            </Link>
          )}
          {token && (
            <button className="header-btn outline" type="button" onClick={handleLogout}>
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
                  setIsAdmin(localStorage.getItem("isAdmin") === "1");
                }}
              />
            }
          />
          {isAdmin && <Route path="/admin" element={<AdminPage />} />}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
