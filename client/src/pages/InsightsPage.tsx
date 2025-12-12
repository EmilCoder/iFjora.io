import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type IdeaListItem = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  market?: string | null;
  techService?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  fundingTotal?: number | null;
  fundingRounds?: number | null;
  analysis?: {
    score?: number;
    dataScore?: number;
    ideaScore?: number | null;
    combinedScore?: number;
    strengths?: string[];
    weaknesses?: string[];
    summary?: string;
    explanation?: string | null;
  };
};

type ErrorResponse = {
  message?: string;
};

function InsightsPage() {
  const [ideas, setIdeas] = useState<IdeaListItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const latest = (location.state as { latestAnalysis?: IdeaListItem & { note?: string } })?.latestAnalysis;

  const activeInsight = useMemo(() => {
    if (latest) return latest;
    if (ideas.length > 0) {
      const found = ideas.find((i) => i.id === activeId);
      if (found) return found;
      return ideas[0];
    }
    return null;
  }, [latest, ideas, activeId]);

  async function fetchIdeas() {
    const token = localStorage.getItem("token");
    if (!token) {
      // Vi skjuler status når bruker ikke er logget inn, siden vi viser siste analyse likevel.
      setStatus("");
      return;
    }
    setStatus("Henter ideer...");
    try {
      const res = await fetch(`${API_URL}/api/ideas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Kunne ikke hente ideer.");
        return;
      }
      const data = (await res.json()) as IdeaListItem[];
      setIdeas(data);
      if (data.length > 0) {
        setActiveId(data[0].id);
      }
      setStatus(data.length === 0 ? "Ingen ideer ennå." : "");
    } catch {
      setStatus("Klarte ikke å kontakte serveren.");
    }
  }

  useEffect(() => {
    fetchIdeas();
  }, []);

  const strengths = activeInsight?.analysis?.strengths;
  const weaknesses = activeInsight?.analysis?.weaknesses;
  const summary = activeInsight?.analysis?.summary;
  const title = activeInsight?.title;
  const content = activeInsight?.content;
  const score = activeInsight?.analysis?.combinedScore ?? activeInsight?.analysis?.score;
  const dataScore = activeInsight?.analysis?.dataScore;
  const ideaScore = activeInsight?.analysis?.ideaScore;
  const explanation = activeInsight?.analysis?.explanation;
  const market = activeInsight?.market;
  const techService = activeInsight?.techService;
  const country = activeInsight?.country;
  const region = activeInsight?.region;
  const city = activeInsight?.city;
  const fundingTotal = activeInsight?.fundingTotal;
  const fundingRounds = activeInsight?.fundingRounds;
  const strengthsList = strengths && strengths.length > 0 ? strengths : ["Ingen styrker mottatt fra AI."];
  const weaknessesList =
    weaknesses && weaknesses.length > 0 ? weaknesses : ["Ingen svakheter mottatt fra AI."];

  const parsedExplanation = useMemo(() => {
    if (!explanation) return null;
    try {
      return JSON.parse(explanation) as any;
    } catch {
      return null;
    }
  }, [explanation]);

  async function handleDeleteIdea(id: number) {
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("Du må være logget inn for å slette en idé.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/ideas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Kunne ikke slette idéen.");
        return;
      }
      setIdeas((prev) => prev.filter((i) => i.id !== id));
      setActiveId((prev) => {
        if (prev === id) {
          const remaining = ideas.filter((i) => i.id !== id);
          return remaining.length > 0 ? remaining[0].id : null;
        }
        return prev;
      });
      setStatus("Idé slettet.");
    } catch {
      setStatus("Klarte ikke å slette idéen.");
    }
  }

  if (!activeInsight) {
    return (
      <div className="insights-page">
        <div className="insights-shell insights-empty-shell">
          <section className="insights-hero">
            <div className="insights-hero-text">
              <p className="eyebrow">Innsikt</p>
              <h1>Ingen ideer ennå</h1>
              <p>Send inn en idé for å få simulert analyse og innsikt her.</p>
            </div>
          </section>

          <div className="insights-actions">
            <button
              type="button"
              className="insights-btn empty-cta"
              onClick={() => navigate("/ideas")}
            >
              Send inn første idé
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <div className="insights-shell">
        <section className="insights-hero">
          <div className="insights-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="presentation">
              <rect
                x="8"
                y="8"
                width="32"
                height="32"
                rx="4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                d="M16 18h16m-16 8h8m-8 8h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1>Innsikt</h1>
          <p className="insights-sub">
            Rapport for <strong>{title}</strong>
          </p>
        </section>

        <div className="insights-container">
          {ideas.length > 0 && (
            <div className="insights-card">
              <h3>Dine ideer</h3>
              <p className="insights-muted">Velg hvilken analyse du vil se.</p>
              <div className="idea-selector">
                {ideas.map((idea) => (
                  <button
                    key={idea.id}
                    type="button"
                    className={`idea-chip ${activeInsight?.id === idea.id ? "active" : ""}`}
                    onClick={() => setActiveId(idea.id)}
                  >
                    <span className="chip-title">{idea.title}</span>
                    {idea.analysis?.score !== undefined && (
                      <span className="chip-score">{idea.analysis.score}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="insights-flow">
            <div className="insights-card">
              <div className="insights-card-header">
                <div>
                  <h2>Din beskrivelse</h2>
                  {summary && <p className="insights-muted">{summary}</p>}
                </div>
                <button
                  type="button"
                  className="insights-btn delete-btn"
                  onClick={() => handleDeleteIdea(activeInsight.id)}
                >
                  Slett idé
                </button>
              </div>
              <p>{content}</p>
            </div>

            <div className="insights-grid-3">
              <div className="insights-card metric-card">
                <div className="metric-label">Kombinert score</div>
                <div className="metric-value">{score ?? "—"}</div>
                <p className="insights-muted">Vektet kombinasjon av data- og idéanalyse.</p>
              </div>
              <div className="insights-card metric-card">
                <div className="metric-label">Data-modell</div>
                <div className="metric-value">{dataScore ?? "—"}</div>
                <p className="insights-muted">Basert på historiske mønstre/funding/geografi.</p>
              </div>
              <div className="insights-card metric-card">
                <div className="metric-label">Idé/VC-score</div>
                <div className="metric-value">{ideaScore ?? "—"}</div>
                <p className="insights-muted">Språkmodellens vurdering av pitch/idé.</p>
              </div>
            </div>

            <div className="insights-card">
              <h3>Metadata</h3>
              <div className="meta-chips">
                {market && <span className="meta-chip">Marked: {market}</span>}
                {techService && <span className="meta-chip">Teknologi: {techService}</span>}
                {(country || region || city) && (
                  <span className="meta-chip">
                    Lokasjon: {[city, region, country].filter(Boolean).join(", ")}
                  </span>
                )}
                {fundingTotal !== null && fundingTotal !== undefined && (
                  <span className="meta-chip">Funding: {fundingTotal} USD</span>
                )}
                {fundingRounds !== null && fundingRounds !== undefined && (
                  <span className="meta-chip">Runder: {fundingRounds}</span>
                )}
              </div>
            </div>

            <div className="insights-card">
              <h3>Styrker</h3>
              <ul className="insights-list">
                {strengthsList.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="insights-card">
              <h3>Svakheter</h3>
              <ul className="insights-list">
                {weaknessesList.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>

            {parsedExplanation && (
              <div className="insights-card">
                <h3>Detaljert AI-kommentar</h3>
                {parsedExplanation.overall_comment && (
                  <p className="insights-muted">{parsedExplanation.overall_comment}</p>
                )}
                <div className="insights-explainer-grid">
                  {["team", "market", "product", "potential", "valuation"].map((key) => {
                    const section = parsedExplanation[key];
                    if (!section) return null;
                    return (
                      <div key={key} className="insights-explainer-item">
                        <div className="insights-chip label">{key.toUpperCase()}</div>
                        {section.comment && <p>{section.comment}</p>}
                        {section.score !== undefined && (
                          <p className="insights-muted">Score: {section.score}/10</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="insights-actions">
              <button
                type="button"
                className="insights-btn outline"
                onClick={() => navigate("/ideas")}
              >
                Prøv ny idé
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InsightsPage;
