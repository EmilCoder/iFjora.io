# -*- coding: utf-8 -*-
"""
Streamlit-app for Startup Success AI
"""

import json
import sys

import streamlit as st

# Importer både predict_success_score OG PreprocessMetadata
from train_startup_model import predict_success_score, PreprocessMetadata
from ollama_explainer import (
    map_text_to_category_with_llama,
    vc_evaluate_startup_with_ollama,
)

# ----------------------------------------------------------------------
# Fix for joblib-pickle: gjør PreprocessMetadata tilgjengelig på '__main__'
# slik at gamle .pkl-filer som peker på '__main__.PreprocessMetadata'
# kan lastes uten feil.
# ----------------------------------------------------------------------
sys.modules["__main__"].PreprocessMetadata = PreprocessMetadata

# -------------------------------------------------
# Last inn kategorier fra treningsdata
# -------------------------------------------------
with open("all_categories.json") as f:
    ALL_CATEGORIES = json.load(f)

# -------------------------------------------------
# Grunnoppsett for siden
# -------------------------------------------------
st.set_page_config(page_title="Startup Success AI", page_icon="🚀")

st.title("🚀 Startup Success AI")
st.write(
    "Fyll inn informasjon om startupen din under, så estimerer modellen "
    "sannsynligheten for suksess basert på historiske data og en "
    "VC-inspirert vurdering av idéen din."
)

st.markdown("---")

# -------------------------------------------------
# Skjema med input-felt (uten datoer)
# -------------------------------------------------
with st.form("startup_form"):
    col1, col2 = st.columns(2)

    with col1:
        market = st.text_input(
            "Marked / kategori",
            help="F.eks. Software, Fintech, Health, AI ..."
        )
        tech_service = st.text_input(
            "Teknologi / tjeneste",
            help="Kort beskrivelse, f.eks. 'AI-plattform for lærere'"
        )
        country = st.text_input(
            "Land (landkode, f.eks. USA, NOR, SWE)",
            value="NOR"
        )
        region = st.text_input(
            "Region",
            help="F.eks. 'Oslo', 'Silicon Valley', 'Stockholm-regionen'"
        )
        city = st.text_input(
            "By",
            value="Oslo"
        )

    with col2:
        funding_total = st.number_input(
            "Total funding (USD)",
            min_value=0,
            value=0,
            step=10000,
            help="Summen av all kapital dere har hentet (i USD)."
        )
        funding_rounds = st.number_input(
            "Antall funding-runder",
            min_value=0,
            value=0,
            step=1
        )

    idea = st.text_area(
        "Idé / pitch (anbefalt)",
        help=(
            "Beskriv team, marked, produkt, potensial og kapitalbehov så godt du kan. "
            "Jo mer konkret du er, jo bedre vurdering kan AI-en gjøre."
        )
    )

    submitted = st.form_submit_button("Beregn suksess-score 🚀")

# -------------------------------------------------
# Når brukeren trykker på knappen
# -------------------------------------------------
if submitted:

    # -------------------------------
    # LLaMA tolker brukerens input til datasett-kategorier
    # -------------------------------
    mapped_market = map_text_to_category_with_llama(market, ALL_CATEGORIES)
    if mapped_market:
        st.info(f"🧠 Marked tolket som: **{mapped_market}**")
    else:
        mapped_market = market or "Unknown"

    mapped_tech = map_text_to_category_with_llama(tech_service, ALL_CATEGORIES)
    if mapped_tech:
        st.info(f"🧠 Teknologi/tjeneste tolket som: **{mapped_tech}**")
    else:
        mapped_tech = tech_service or "Unknown"

    # -------------------------------
    # Bygg startup-data for CatBoost
    # (ingen datoer – kun felter modellen faktisk bruker)
    # -------------------------------
    startup_data = {
        "homepage_url": "http://example.com",
        "category_list": mapped_market,
        "subcategory": mapped_tech,
        "funding_total_usd": str(funding_total),
        "funding_rounds": int(funding_rounds),
        "country_code": country.strip() if country.strip() != "" else "Unknown",
        "state_code": "",
        "region": region.strip() if region.strip() != "" else "Unknown",
        "city": city.strip() if city.strip() != "" else "Unknown",
    }

    # -------------------------------
    # 1) CatBoost-resultat (data-basert grunnscore)
    # -------------------------------
    with st.spinner("Kjører prediksjonsmodell (historiske data)..."):
        result = predict_success_score(startup_data)

    # Støtter både nytt og gammelt format fra predict_success_score
    if "success_probability" in result:
        p = float(result["success_probability"])
        data_score = float(result.get("success_probability_percent", p * 100.0))
    else:
        # Bakoverkompatibilitet med gammel versjon som returnerer 'success_score'
        data_score = float(result.get("success_score", 0.0))
        p = data_score / 100.0 if data_score is not None else 0.0

    # Definer en enkel risikokategori basert på sannsynlighet
    if p < 0.33:
        risk_level = "Høy risiko"
    elif p < 0.66:
        risk_level = "Moderat risiko"
    else:
        risk_level = "Lav risiko"

    # -------------------------------
    # 2) LLaMA VC-vurdering av idé/pitch
    # -------------------------------
    if idea and idea.strip():
        with st.spinner("Vurderer idé/pitch (VC-analyse med LLaMA)..."):
            vc_result = vc_evaluate_startup_with_ollama(idea, startup_data)
    else:
        vc_result = None

    if vc_result:
        idea_score = vc_result.get("overall_score", 50)

        # Kombiner: 65 % VC-vurdering, 35 % historiske data
        combined_score = round(0.65 * data_score + 0.35 * idea_score, 2)

        # Lag forklaringstekst basert på VC-resultat
        explanation = f"""
### Analyse av startupen (VC-perspektiv)

**Team ({vc_result['team']['score']}/10):**  
{vc_result['team']['comment']}

**Market ({vc_result['market']['score']}/10):**  
{vc_result['market']['comment']}

**Product ({vc_result['product']['score']}/10):**  
{vc_result['product']['comment']}

**Potential ({vc_result['potential']['score']}/10):**  
{vc_result['potential']['comment']}

**Valuation ({vc_result['valuation']['score']}/10):**  
{vc_result['valuation']['comment']}

---

### Samlet VC-vurdering: {vc_result['overall_score']} / 100  
{vc_result['overall_comment']}
"""
    else:
        idea_score = None
        combined_score = data_score
        explanation = (
            "Ingen VC-vurdering er gjort fordi det ikke ble skrevet inn noen idé/pitch. "
            "Totalvurderingen er derfor kun basert på historiske data."
        )

    # -------------------------
    # Vis resultater i UI
    # -------------------------
    st.markdown("---")
    st.subheader("Resultater")

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric(
            label="Data-basert score",
            value=f"{data_score:.2f} %",
            help="Basert kun på historiske data (CatBoost-modellen)."
        )
    with col2:
        if idea_score is not None:
            st.metric(
                label="Idé-score (VC / LLaMA)",
                value=f"{idea_score:.2f} / 100",
                help=(
                    "Hvor sterk idéen virker basert på VC-rammeverket "
                    "(team, marked, produkt, potensial, valuering)."
                ),
            )
        else:
            st.metric(
                label="Idé-score (VC / LLaMA)",
                value="—",
                help="Ingen idé/pitch ble analysert.",
            )
    with col3:
        st.metric(
            label="Risikokategori (data-modell)",
            value=risk_level,
        )

    # Forklaring
    st.markdown("### AI-basert forklaring")
    st.write(explanation)

    # Vis idé/pitch nederst
    if idea.strip():
        st.markdown("### Din idé / pitch")
        st.write(idea)
