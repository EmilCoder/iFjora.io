# -*- coding: utf-8 -*-
"""
Lite FastAPI-endepunkt som pakker inn eksisterende modell + Ollama-kall.
Start med:
    conda activate startup-ai
    uvicorn service:app --host 0.0.0.0 --port 8001
"""
from __future__ import annotations

import json
import sys
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from train_startup_model import predict_success_score, PreprocessMetadata
from ollama_explainer import (
    map_text_to_category_with_llama,
    vc_evaluate_startup_with_ollama,
)

# Sørg for at pickle-lastere finner PreprocessMetadata fra __main__
sys.modules["__main__"].PreprocessMetadata = PreprocessMetadata

app = FastAPI(title="Startup AI API", version="1.0.0")

with open("all_categories.json") as f:
    ALL_CATEGORIES = json.load(f)


class IdeaRequest(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    market: Optional[str] = None  # category_list
    tech_service: Optional[str] = None  # subcategory
    team_description: Optional[str] = None
    country: Optional[str] = None  # country_code
    region: Optional[str] = None
    city: Optional[str] = None
    funding_total: Optional[float] = 0
    funding_rounds: Optional[int] = 0


class AnalysisResponse(BaseModel):
    score: float
    strengths: list[str]
    weaknesses: list[str]
    summary: str
    explanation: Optional[str] = None
    data_score: Optional[float] = None
    idea_score: Optional[float] = None
    combined_score: Optional[float] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(req: IdeaRequest):
  # Kartlegg markeds/tech-felter via LLaMA hvis mulig
    mapped_market = map_text_to_category_with_llama(req.market or "", ALL_CATEGORIES)
    mapped_tech = map_text_to_category_with_llama(req.tech_service or "", ALL_CATEGORIES)

    idea_text = req.content
    if req.team_description and req.team_description.strip():
        idea_text += f"\n\nTeam: {req.team_description.strip()}"

    startup_data = {
        "homepage_url": "http://example.com",
        "category_list": mapped_market or req.market or "Unknown",
        "subcategory": mapped_tech or req.tech_service or "Unknown",
        "funding_total_usd": str(req.funding_total or 0),
        "funding_rounds": int(req.funding_rounds or 0),
        "country_code": (req.country or "Unknown").strip(),
        "state_code": "",
        "region": (req.region or "Unknown").strip(),
        "city": (req.city or "Unknown").strip(),
    }

    # 1) Data-modell
    try:
        result = predict_success_score(startup_data)
    except Exception as exc:  # pragma: no cover - runtime safeguard
        raise HTTPException(status_code=500, detail=f"Feil i data-modellen: {exc}") from exc

    if "success_probability" in result:
        p = float(result["success_probability"])
        data_score = float(result.get("success_probability_percent", p * 100.0))
    else:
        data_score = float(result.get("success_score", 0.0))
        p = data_score / 100.0 if data_score is not None else 0.0

    risk_level = "Høy risiko"
    if p >= 0.66:
        risk_level = "Lav risiko"
    elif p >= 0.33:
        risk_level = "Moderat risiko"

    # 2) VC-vurdering med LLaMA (kan feile hvis Ollama ikke kjører)
    vc_result = None
    if idea_text and idea_text.strip():
        try:
            vc_result = vc_evaluate_startup_with_ollama(idea_text, startup_data)
        except Exception:
            # Fortsett uten VC hvis Ollama ikke svarer
            vc_result = None

    if vc_result:
        idea_score = vc_result.get("overall_score", 50)
        combined_score = round(0.65 * data_score + 0.35 * idea_score, 2)
        summary = vc_result.get("overall_comment", "Analyse generert av LLaMA.")
        strengths = [vc_result.get("team", {}).get("comment", "Teamvurdering tilgjengelig.")]
        weaknesses = [vc_result.get("product", {}).get("comment", "Produktrisiko tilgjengelig.")]
        explanation = json.dumps(vc_result, ensure_ascii=False)
    else:
        idea_score = None
        combined_score = data_score
        summary = "Ingen VC-vurdering (Ollama kjører ikke eller ingen idé oppgitt). Viser kun data-score."
        strengths = ["Historiske mønstre indikerer moderat/lav risiko basert på oppgitte tall."]
        weaknesses = ["Ingen idé-basert vurdering er gjort."]
        explanation = None

    return AnalysisResponse(
        score=combined_score,
        strengths=strengths,
        weaknesses=weaknesses,
        summary=summary,
        explanation=explanation,
        data_score=data_score,
        idea_score=idea_score,
        combined_score=combined_score,
    )
