import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type IdeaListItem = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  analysis?: {
    score?: number;
    strengths?: string[];
    weaknesses?: string[];
    summary?: string;
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
  const score = activeInsight?.analysis?.score;

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
        <div className="insights-shell">
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
              className="insights-btn solid"
              onClick={() => navigate("/ideas")}
            >
              Send inn første idé
            </button>
          </div>
        </div>
      </div>
    );
  }

  const barCategories = [
    { label: "Teamets styrke", value: 75 },
    { label: "Vekstpotensial", value: 68 },
    { label: "Markedsstørrelse", value: 72 },
    { label: "Produktkvalitet", value: 70 },
    { label: "Modenhet", value: 65 },
  ];

  const competitors = [
    {
      name: "Too Good To Go",
      description: "Kjent aktør som lar folk hente overskuddsmat fra butikker/restauranter.",
      pros: [
        "Stor base av brukere og butikker",
        "Sterkt varemerke og bred kjennskap",
        "Har etablert logistikk/partnerskap",
      ],
      cons: [
        "Fokuserer mest på butikker, ikke nabolag",
        "Kan ha høy konkurranse i byer",
        "Lite personlige/nære delingsfunksjoner",
      ],
      icon: "🍱",
    },
    {
      name: "Facebook-grupper",
      description: "Lokale grupper for salg/gi bort, men ikke matspesifikke.",
      pros: [
        "Mange brukere allerede på plattformen",
        "Lav terskel å poste",
        "Kan gi rask respons i aktive grupper",
      ],
      cons: [
        "Lite struktur for mat (holdbarhet/sikkerhet)",
        "Ingen verifisering av kvalitet",
        "Uoversiktlig feed, mye støy",
      ],
      icon: "📘",
    },
    {
      name: "OLIO",
      description: "Internasjonal matdelings-app som matcher naboer.",
      pros: [
        "App skreddersydd for matdeling",
        "Har funksjoner for nabomatching",
        "Større nettverk i enkelte regioner",
      ],
      cons: [
        "Kan være få brukere i enkelte områder",
        "Lite lokal tilpasning",
        "Fokuserer ikke på innsikt/score",
      ],
      icon: "🍊",
    },
  ];

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
                  <p className="insights-muted">{summary}</p>
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

            <div className="insights-grid-2">
              <div className="insights-card">
                <h3>Risikovurdering</h3>
                <p className="insights-muted">
                  Foreløpig vurdering av risiko- og usikkerhetsnivå basert på tekstinput.
                </p>
                <div className="insights-risk-box">
                  <span>Lav</span>
                  <span>Middels</span>
                  <span>Høy</span>
                  <span>Risiko</span>
                </div>
              </div>

              <div className="insights-card">
                <div className="insights-card-header">
                  <h3>Scorekort</h3>
                  <div className="pill">Totalt: {score}/100</div>
                </div>
                <div className="insights-bars">
                  {barCategories.map((cat) => (
                    <div key={cat.label} className="insights-bar-row">
                      <span>{cat.label}</span>
                      <div className="insights-bar">
                        <div className="insights-bar-fill" style={{ width: `${cat.value}%` }} />
                      </div>
                      <span className="insights-bar-val">{cat.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="insights-stack">
              <div className="insights-card">
                <h3>Teamets styrke</h3>
                <p className="insights-muted">
                  Oppsummering av teamets relevante erfaring og gjennomføringsevne.
                </p>
                <div className="insights-bar insights-long">
                  <div className="insights-bar-fill" style={{ width: "82%" }} />
                </div>
              </div>

              <div className="insights-card">
                <h3>Markedspotensial</h3>
                <p className="insights-muted">
                  Foreløpig vurdering av markedets størrelse og betalingsvilje.
                </p>
                <div className="insights-bar insights-long">
                  <div className="insights-bar-fill" style={{ width: "78%" }} />
                </div>
              </div>

              <div className="insights-card">
                <h3>Produktkvalitet</h3>
                <p className="insights-muted">
                  Hvor tydelig og gjennomførbar produktideen fremstår basert på input.
                </p>
                <div className="insights-bar insights-long">
                  <div className="insights-bar-fill" style={{ width: "70%" }} />
                </div>
              </div>

              <div className="insights-card">
                <h3>Vekstpotensial</h3>
                <p className="insights-muted">
                  Indikasjon på skaleringsevne og videre vekstmuligheter.
                </p>
                <div className="insights-bar insights-long">
                  <div className="insights-bar-fill" style={{ width: "77%" }} />
                </div>
              </div>

              <div className="insights-card">
                <h3>Økonomisk modenhet</h3>
                <p className="insights-muted">
                  Vurdering av forretningsmodell og økonomisk robusthet.
                </p>
                <div className="insights-bar insights-long">
                  <div className="insights-bar-fill" style={{ width: "75%" }} />
                </div>
              </div>
            </div>

            <div className="insights-card">
              <h3>Styrker</h3>
              <ul className="insights-list">
                {strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="insights-card">
              <h3>Svakheter</h3>
              <ul className="insights-list">
                {weaknesses.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>

            <div className="insights-card">
              <h3>Konkurrenter</h3>
              <div className="insights-competitors">
                {competitors.map((c) => (
                  <div key={c.name} className="insights-competitor-card">
                    <div className="insights-competitor-header">
                      <div className="insights-competitor-icon">{c.icon}</div>
                      <div>
                        <div className="insights-competitor-name">{c.name}</div>
                        <div className="insights-muted">{c.description}</div>
                      </div>
                    </div>
                    <div className="insights-procon">
                      <div>
                        <div className="insights-chip success">Hva de gjør bra</div>
                        <ul className="insights-list">
                          {c.pros.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="insights-chip danger">Hva de ikke løser for denne ideen</div>
                        <ul className="insights-list">
                          {c.cons.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="insights-card insights-next-card">
              <div className="insights-next-header">
                <h3>Neste steg</h3>
                <p className="insights-muted">
                  Basert på ideen din og vurderingen over, er disse neste stegene foreslått for å komme videre:
                </p>
              </div>
              <div className="insights-next-steps">
                <div className="insights-step-tile">
                  <div className="insights-step-num accent">1</div>
                  <h4>Snakk med 3–5 personer i målgruppen</h4>
                  <p>
                    Undersøk hvordan folk i nabolaget faktisk vil bruke appen. Spør om trygghet, hentepunkter,
                    hvilke typer mat de ville delt.
                  </p>
                </div>
                <div className="insights-step-tile">
                  <div className="insights-step-num accent">2</div>
                  <h4>Test ideen i liten skala</h4>
                  <p>
                    Opprett en liten pilot i eget nabolag: 3–10 deltakere. Se hvilke utfordringer som oppstår og
                    hva som må justeres.
                  </p>
                </div>
                <div className="insights-step-tile">
                  <div className="insights-step-num accent">3</div>
                  <h4>Avklar trygghetsmekanismer</h4>
                  <p>
                    Brukertillit er kritisk. Sett opp en enkel løsning: verifisering via SMS/e-post, tydelige
                    bilder og hentetidspunkt.
                  </p>
                </div>
              </div>
            </div>

            <div className="insights-actions">
              <button
                type="button"
                className="insights-btn outline"
                onClick={() => navigate("/ideas")}
              >
                Prøv ny idé
              </button>
              <button
                type="button"
                className="insights-btn solid"
                onClick={() => navigate("/auth")}
              >
                Lagre resultatet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InsightsPage;
