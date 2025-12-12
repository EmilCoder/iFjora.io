# -*- coding: utf-8 -*-
"""
Created on Wed Dec 10 10:36:26 2025

@author: storm
"""

# ollama_explainer.py
import json
import requests
from textwrap import dedent


OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.1:8b"   # endre hvis du bruker en annen modell


def _build_context(startup_data: dict, result: dict, idea_text: str | None = None) -> str:
    """Bygger en lesbar tekst av structured data + modellresultat + pitch."""
    lines = []

    lines.append("Strukturert informasjon om startupen:")
    lines.append(f"- Marked / hovedkategori: {startup_data.get('category_list')}")
    lines.append(f"- Land: {startup_data.get('country_code')}")
    lines.append(f"- Region: {startup_data.get('region')}")
    lines.append(f"- By: {startup_data.get('city')}")
    lines.append(f"- Total funding (USD): {startup_data.get('funding_total_usd')}")
    lines.append(f"- Antall funding-runder: {startup_data.get('funding_rounds')}")
    lines.append(f"- Stiftelsesdato: {startup_data.get('founded_at')}")
    lines.append(f"- Dato for første funding: {startup_data.get('first_funding_at')}")
    lines.append(f"- Dato for siste funding: {startup_data.get('last_funding_at')}")

    lines.append("")
    lines.append("Prediksjon fra maskinlæringsmodellen:")
    lines.append(f"- Sannsynlighet for suksess: {result['success_probability']:.3f}")
    lines.append(f"- Suksess-score (0–100): {result['success_score']:.2f}")
    lines.append(f"- Risikonivå: {result['risk_level']}")

    if idea_text and idea_text.strip():
        lines.append("")
        lines.append("Gründerens idé / pitch:")
        lines.append(idea_text.strip())

    return "\n".join(lines)


def explain_prediction(
    startup_data: dict,
    result: dict,
    idea_text: str | None = None,
    idea_score: float | None = None,
    final_score: float | None = None,
) -> str:
    """
    Bruker Ollama + Llama til å generere en forklaring på norsk.
    Nå tar den også inn idé-score og kombinert totalscore dersom det finnes.
    """
    lines = []

    lines.append("Strukturert informasjon om startupen:")
    lines.append(f"- Marked / hovedkategori: {startup_data.get('category_list')}")
    lines.append(f"- Land: {startup_data.get('country_code')}")
    lines.append(f"- Region: {startup_data.get('region')}")
    lines.append(f"- By: {startup_data.get('city')}")
    lines.append(f"- Total funding (USD): {startup_data.get('funding_total_usd')}")
    lines.append(f"- Antall funding-runder: {startup_data.get('funding_rounds')}")
    lines.append(f"- Stiftelsesdato: {startup_data.get('founded_at')}")
    lines.append(f"- Dato for første funding: {startup_data.get('first_funding_at')}")
    lines.append(f"- Dato for siste funding: {startup_data.get('last_funding_at')}")
    lines.append("")

    lines.append("Data-basert prediksjon (historiske mønstre):")
    lines.append(f"- Sannsynlighet for suksess (data-modell): {result['success_probability']:.3f}")
    lines.append(f"- Suksess-score (0–100, data-modell): {result['success_score']:.2f}")
    lines.append(f"- Risikonivå (data-modell): {result['risk_level']}")

    if idea_score is not None:
        lines.append("")
        lines.append("Idé-basert vurdering (språkmodell):")
        lines.append(f"- Idé-score (0–100): {idea_score:.2f}")

    if final_score is not None:
        lines.append("")
        lines.append("Kombinert vurdering:")
        lines.append(f"- Total suksess-score (kombinert): {final_score:.2f}")

    if idea_text and idea_text.strip():
        lines.append("")
        lines.append("Gründerens idé / pitch:")
        lines.append(idea_text.strip())

    context = "\n".join(lines)

    prompt = dedent(f"""
    Du er en erfaren startup-rådgiver og investoranalytiker.

    Du får:
    - strukturert informasjon om en startup
    - resultatet fra en data-basert prediksjonsmodell (historiske mønstre)
    - en separat idé-score som vurderer selve forretningsidéen
    - en kombinert totalscore (dersom begge finnes)
    - eventuelt en kort pitch skrevet av gründeren

    Forklaringsoppgave:
    1. Forklar kort hva den data-baserte scoren sier (uten å overdytte detaljer).
    2. Forklar hvordan idé-scoren påvirker helhetsbildet:
       - Er idéen sterkere/svakere enn det dataene skulle tilsi?
    3. Sett dette sammen til en forståelig tolkning av den kombinerte scoren
       (hvis totalscore er gitt).
    4. Gi 3–5 konkrete, praktiske råd til gründeren om hvordan de kan
       forbedre posisjonen sin (produkt, marked, finansiering, strategi).
    5. Skriv på norsk, i en vennlig men ærlig tone.
    6. Ikke vær altfor lang; 3–6 avsnitt holder, bruk gjerne punktlister.

    Her er dataene:

    {context}

    Nå kan du skrive analysen din på norsk:
    """).strip()

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.0
        },
    }

    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        text = data.get("response", "").strip()
        return text or "Klarte ikke å generere en forklaring fra modellen."
    except Exception as e:
        return f"(Feil ved kall til Ollama: {e})"

    
def score_idea_with_ollama(idea_text: str, startup_data: dict | None = None) -> float:
    """
    Bruker Ollama til å gi en idé-score (0–100) basert på pitch-teksten,
    og evt. litt strukturert info om startupen.

    Returnerer et flyttall mellom 0 og 100.
    Hvis noe går galt, returnerer den 50.0 som "nøytral" score.
    """
    if not idea_text or not idea_text.strip() or len(idea_text.split()) < 5:
        return 10.0  # veldig svak idé

    context_lines = []
    if startup_data is not None:
        context_lines.append("Strukturert informasjon (kontekst, ikke fasit):")
        context_lines.append(f"- Marked / hovedkategori: {startup_data.get('category_list')}")
        context_lines.append(f"- Land: {startup_data.get('country_code')}")
        context_lines.append(f"- Region: {startup_data.get('region')}")
        context_lines.append(f"- By: {startup_data.get('city')}")
        context_lines.append(f"- Total funding (USD): {startup_data.get('funding_total_usd')}")
        context_lines.append(f"- Antall funding-runder: {startup_data.get('funding_rounds')}")
        context_lines.append("")
    context_lines.append("Pitch / idé skrevet av gründeren:")
    context_lines.append(idea_text.strip())

    context = "\n".join(context_lines)

    prompt = dedent(f"""
    Du er en erfaren tidligfase-investor.

    Du skal vurdere KUN selve forretningsidéen, basert på:
    - hvor tydelig problemet er
    - hvor konkret målgruppen er
    - hvor mye idéen skiller seg fra eksisterende løsninger
    - hvor realistisk og skalerbar den virker
    - hvor klar verdiforslaget er (hvorfor noen skulle bry seg)

    Skala for idé-score:
    - 0–19: svært svak idé, lite tydelig problem eller verdi
    - 20–39: svak idé, noen elementer, men mye uklart
    - 40–59: middels interessant, noe potensial, men trenger tydeligere fokus
    - 60–79: god idé med tydelig potensial og fornuftig logikk
    - 80–100: svært sterk idé med tydelig problem, målgruppe og skalerbarhet

    VIKTIG:
    - Ignorer gjennomføringsevne, team, flaks og timing.
    - Vurder bare idéen slik den er beskrevet her.
    - Svar KUN med ett heltall mellom 0 og 100.
    - Ingen forklaring, ingen ekstra tekst, bare tallet.

    Her er informasjonen:

    {context}

    Nå: svar KUN med tallet (0–100).
    """).strip()

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.0,  # mer stabil vurdering
        },
    }

    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        raw = data.get("response", "").strip()

        import re
        match = re.search(r"\d+", raw)
        if not match:
            return 50.0
        score = int(match.group(0))
        score = max(0, min(100, score))  # clamp 0–100
        return float(score)

    except Exception as e:
        print(f"[score_idea_with_ollama] Feil ved kall til Ollama: {e}")
        return 50.0

def map_text_to_category_with_llama(text: str, all_categories: list[str]) -> str:
    """
    Mapper brukerens fritekst inn i én kategori som finnes i datasettet.
    Returnerer None hvis den ikke klarer å mappe.
    """

    if not text or not text.strip():
        return None

    # Bruk ALLE kategorier – ikke kutt til 200
    categories_preview = "\n".join(f"- {c}" for c in all_categories)

    prompt = f"""
Du skal matche en fritekst-beskrivelse av et marked eller en teknologi
til den kategorien fra listen under som passer best.

Regler:
- Velg KUN én kategori.
- Kategorien MÅ være hentet fra listen.
- Svar KUN med kategorinavnet, uten ekstra tekst.

Kategorier:
{categories_preview}

Fritekst:
{text}

Svar kun med kategorinavnet:
"""

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1},
    }

    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=60)
        resp.raise_for_status()
        raw = resp.json().get("response", "")
        raw = raw.strip().strip('"').strip("'")

        if not raw:
            return None

        # Debug: se hva modellen faktisk svarte
        print(f"[map_text_to_category_with_llama] LLaMA svarte: {raw!r}")

        # 1) Eksakt match (case-insensitivt)
        for cat in all_categories:
            if raw.lower() == cat.lower():
                return cat

        # 2) Delvis match: hvis svaret er inni en kategori eller omvendt
        for cat in all_categories:
            if raw.lower() in cat.lower() or cat.lower() in raw.lower():
                return cat

        return None

    except Exception as e:
        print(f"[map_text_to_category_with_llama] Feil: {e}")
        return None


def vc_evaluate_startup_with_ollama(idea_text: str, startup_data: dict) -> dict:
    """
    LLaMA-basert VC-vurdering av en startup.
    Nå inkluderer den også en eksplisitt vurdering av product–market fit.
    """

    # Hvis pitch er tom eller ekstremt kort/uinformativ, gi veldig lav score
    if not idea_text or not idea_text.strip() or len(idea_text.split()) < 5:
        return {
            "team": {"score": 1.0, "comment": "Ingen reell pitch eller beskrivelse av team."},
            "market": {"score": 1.0, "comment": "Ingen beskrivelse av marked eller kunde."},
            "product": {"score": 1.0, "comment": "Ingen produkt- eller tjenestebeskrivelse."},
            "potential": {"score": 1.0, "comment": "Ingen informasjon om potensial eller forretningsmodell."},
            "valuation": {"score": 1.0, "comment": "Ingen informasjon om finansiering, verdsettelse eller exit."},
            "product_market_fit": {
                "score": 1.0,
                "comment": "Ingen beskrivelse av hvordan produktet passer markedet."
            },
            "overall_score": 10.0,
            "overall_comment": "Svært svak vurdering – det er i praksis ingen pitch å vurdere.",
        }

    prompt = f"""
Du er en venture capital-investor.

Vurder denne startupen basert på seks kategorier:
- team
- market
- product
- potential
- valuation
- product_market_fit (hvor godt produktet/tjenesten faktisk passer markedet,
  målgruppen og behovene som er beskrevet).

For hver kategori skal du:
- gi en SCORE som flyttall mellom 0 og 10 (f.eks. 6.5)
- gi en kort kommentar på norsk.

Du skal returnere STRICT JSON med følgende struktur (ingen ekstra tekst):

{{
  "team": {{
    "score": <float 0-10>,
    "comment": "<tekst>"
  }},
  "market": {{
    "score": <float 0-10>,
    "comment": "<tekst>"
  }},
  "product": {{
    "score": <float 0-10>,
    "comment": "<tekst>"
  }},
  "potential": {{
    "score": <float 0-10>,
    "comment": "<tekst>"
  }},
  "valuation": {{
    "score": <float 0-10>,
    "comment": "<tekst>"
  }},
  "product_market_fit": {{
    "score": <float 0-10>,
    "comment": "<tekst som eksplisitt sier om produktet passer markedet eller ikke>"
  }}
}}

Spesielt for product_market_fit:
- vurder hvor godt produktet/tjenesten faktisk matcher markedet/kategorien,
  målgruppen og kundebehovene
- si tydelig om det er god match, svak match eller mis-match.

Startup-data (kontekst):
{json.dumps(startup_data, indent=2, ensure_ascii=False)}

Pitch:
\"\"\"{idea_text}\"\"\"


GI KUN JSON. INGEN FORKLARING.
"""

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.0},
    }

    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
        resp.raise_for_status()
        outer = resp.json()

        raw = outer.get("response", "").strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == -1:
            raise ValueError(f"Fant ikke JSON i responsen: {raw!r}")

        json_str = raw[start:end]
        data = json.loads(json_str)

    except Exception as e:
        print("[vc_evaluate_startup_with_ollama] Feil:", e)
        return {
            "team": {"score": 5.0, "comment": "Feil under vurdering."},
            "market": {"score": 5.0, "comment": "Feil under vurdering."},
            "product": {"score": 5.0, "comment": "Feil under vurdering."},
            "potential": {"score": 5.0, "comment": "Feil under vurdering."},
            "valuation": {"score": 5.0, "comment": "Feil under vurdering."},
            "product_market_fit": {
                "score": 5.0,
                "comment": "Feil under vurdering."
            },
            "overall_score": 50.0,
            "overall_comment": "Standardverdi pga teknisk feil i VC-vurderingen.",
        }

    # ------- Parse og bygg struktur -------

    def parse_block(name: str) -> dict:
        block = data.get(name, {}) or {}
        score = float(block.get("score", 5.0))
        comment = str(block.get("comment", "")) or "Ingen kommentar."
        return {"score": score, "comment": comment}

    team = parse_block("team")
    market = parse_block("market")
    product = parse_block("product")
    potential = parse_block("potential")
    valuation = parse_block("valuation")
    product_market_fit = parse_block("product_market_fit")

    avg_score = (
        team["score"]
        + market["score"]
        + product["score"]
        + potential["score"]
        + valuation["score"]
        + product_market_fit["score"]
    ) / 6.0

    overall_score = round(avg_score * 10.0, 2)  # 0–10 → 0–100

    return {
        "team": team,
        "market": market,
        "product": product,
        "potential": potential,
        "valuation": valuation,
        "product_market_fit": product_market_fit,
        "overall_score": overall_score,
        "overall_comment": "Gjennomsnittlig vurdering basert på fem VC-kriterier pluss product–market fit.",
    }

    # ------- Parse og bygg struktur -------

    def parse_block(name: str) -> dict:
        block = data.get(name, {}) or {}
        score = float(block.get("score", 5.0))
        comment = str(block.get("comment", "")) or "Ingen kommentar."
        return {"score": score, "comment": comment}

    team = parse_block("team")
    market = parse_block("market")
    product = parse_block("product")
    potential = parse_block("potential")
    valuation = parse_block("valuation")

    avg_score = (
        team["score"]
        + market["score"]
        + product["score"]
        + potential["score"]
        + valuation["score"]
    ) / 5.0

    overall_score = round(avg_score * 10.0, 2)  # 0–10  →  0–100

    return {
        "team": team,
        "market": market,
        "product": product,
        "potential": potential,
        "valuation": valuation,
        "overall_score": overall_score,
        "overall_comment": "Gjennomsnittlig vurdering basert på fem VC-kriterier.",
    }
