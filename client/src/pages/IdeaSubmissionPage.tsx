import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type IdeaResponse = {
  id: number;
  title: string;
  content: string;
  analysis?: {
    score: number;
    strengths?: string[];
    weaknesses?: string[];
    summary?: string;
    explanation?: string;
    dataScore?: number;
    ideaScore?: number;
    combinedScore?: number;
  };
};

type ErrorResponse = {
  message?: string;
};

function IdeaSubmissionPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "success" | "error" | "info">("idle");
  const [analysis, setAnalysis] = useState<IdeaResponse["analysis"] | null>(null);
  const [market, setMarket] = useState("");
  const [techService, setTechService] = useState("");
  const [country, setCountry] = useState("NOR");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [fundingTotal, setFundingTotal] = useState<number>(0);
  const [fundingRounds, setFundingRounds] = useState<number>(0);
  const [team, setTeam] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("Du må være logget inn for å analysere ideen.");
      setStatusType("error");
      return;
    }

    setStatus("Sender inn...");
    setStatusType("info");
    setAnalysis(null);

    try {
      const res = await fetch(`${API_URL}/api/ideas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content,
          market,
          techService,
          country,
          region,
          city,
          fundingTotal,
          fundingRounds,
          team,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse;
        setStatus(err.message ?? "Noe gikk galt.");
        setStatusType("error");
        return;
      }

      const data = (await res.json()) as IdeaResponse;
      setAnalysis(data.analysis ?? null);
      setStatus("Idé analysert.");
      setStatusType("success");
      setTitle("");
      setContent("");
      setMarket("");
      setTechService("");
      setRegion("");
      setCity("");
      setFundingTotal(0);
      setFundingRounds(0);
      setTeam("");

      // Bli på siden og vis analysen her; ingen redirect
    } catch {
      setStatus("Klarte ikke å kontakte serveren.");
      setStatusType("error");
    }
  }

  return (
    <div className="idea-page">
      <section className="idea-hero">
        <div className="idea-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="presentation">
            <path
              d="M32 8c-9 0-16.5 7.2-16.5 16.2 0 5.8 3.2 10.8 8 13.8V46c0 .9.8 1.7 1.8 1.7h3.2v3.7c0 1.2 1 2.1 2.2 2.1h5c1.2 0 2.2-.9 2.2-2.1V47.7h3.2c1 0 1.8-.8 1.8-1.7v-7.9c4.8-3 8-8 8-13.8C48.5 15.2 41 8 32 8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M28 46h8m-4-30v6"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1>Din idé</h1>

        <form className="idea-form" onSubmit={handleSubmit}>
          <div className="idea-grid">
            <div className="idea-field">
              <label className="idea-label" htmlFor="idea-market">
                Marked / kategori
              </label>
              <input
                id="idea-market"
                className="idea-input"
                type="text"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder="F.eks. Software, Fintech, Health..."
              />
            </div>
            <div className="idea-field">
              <label className="idea-label" htmlFor="idea-tech">
                Teknologi / tjeneste
              </label>
              <input
                id="idea-tech"
                className="idea-input"
                type="text"
                value={techService}
                onChange={(e) => setTechService(e.target.value)}
                placeholder="F.eks. AI-plattform, app, SaaS..."
              />
            </div>
          </div>

          <div className="idea-grid">
            <div className="idea-field">
              <label className="idea-label" htmlFor="idea-country">
                Land (kode)
              </label>
              <input
                id="idea-country"
                className="idea-input"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="NOR"
              />
            </div>
            <div className="idea-field">
              <label className="idea-label" htmlFor="idea-region">
                Region
              </label>
              <input
                id="idea-region"
                className="idea-input"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="F.eks. Oslo, Vestland..."
              />
            </div>
            <div className="idea-field">
              <label className="idea-label" htmlFor="idea-city">
                By
              </label>
              <input
                id="idea-city"
                className="idea-input"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Oslo"
              />
            </div>
          </div>

          <div className="idea-grid">
            <div className="idea-field">
              <label className="idea-label" htmlFor="idea-funding-total">
                Total funding (USD)
              </label>
              <input
                id="idea-funding-total"
                className="idea-input"
                type="number"
                min={0}
                value={fundingTotal}
                onChange={(e) => setFundingTotal(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="idea-field">
              <label className="idea-label" htmlFor="idea-funding-rounds">
                Antall funding-runder
              </label>
              <input
                id="idea-funding-rounds"
                className="idea-input"
                type="number"
                min={0}
                value={fundingRounds}
                onChange={(e) => setFundingRounds(Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="idea-field">
            <label className="idea-label" htmlFor="idea-team">
              Teamets erfaring/kompetanse
            </label>
            <textarea
              id="idea-team"
              className="idea-textarea"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              rows={3}
              placeholder="Kort om teamet: erfaring, roller, tidligere prosjekter."
            />
          </div>

          <div className="idea-field">
            <label className="idea-label" htmlFor="idea-title">
              Tittel på din idé
            </label>
            <input
              id="idea-title"
              className="idea-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder='F.eks. "App for smartere budsjett"'
            />
          </div>

          <div className="idea-field">
            <div className="idea-label-row">
              <label className="idea-label" htmlFor="idea-description">
                Beskriv din idé
              </label>
              <span className="idea-hint">
                Forklar kort: Problem → Løsning → Målgruppe → Konkurrenter
              </span>
            </div>
            <textarea
              id="idea-description"
              className="idea-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={5}
              placeholder='F.eks. “Studenter sliter med å holde oversikt over utgifter. Jeg vil lage en app som automatisk kategoriserer kjøp og gir enkle sparetips. Målgruppen er unge voksne med lite økonomisk erfaring.”'
            />
          </div>

          <button
            className="idea-submit"
            type="submit"
            disabled={status === "Sender inn..."}
          >
            {status === "Sender inn..." ? "Analyserer..." : "Analyser"}
          </button>
        </form>

        {status && (
          <div className={`status-banner status-${statusType}`}>{status}</div>
        )}
        {analysis && (
          <div className="idea-analysis">
            <div className="idea-analysis-header">
              <h3>Simulert analyse</h3>
              <Link to="/insights">Gå til innsikt</Link>
            </div>
            {analysis.score !== undefined && (
              <p className="idea-score">Score: {analysis.score}</p>
            )}
            {analysis.summary && <p className="idea-summary">{analysis.summary}</p>}
            <div className="idea-columns">
              {analysis.strengths && (
                <div>
                  <strong>Styrker</strong>
                  <ul>
                    {analysis.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.weaknesses && (
                <div>
                  <strong>Svakheter</strong>
                  <ul>
                    {analysis.weaknesses.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default IdeaSubmissionPage;
