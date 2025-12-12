# -*- coding: utf-8 -*-
"""
Trening av CatBoost-modell for å predikere sannsynlighet for startup-suksess.

Forutsetter at filen 'big_startup_secsees_dataset.csv' ligger i samme mappe.

Hovedidé:
- Bruk Crunchbase-lignende historiske data til å lære sammenhengen mellom
  (kategori, geografi, fundingnivå, antall runder) og sannsynligheten for suksess.
- Unngå å bruke features som direkte avslører label (f.eks. alder basert på sist funding).
- Bygg en preprocess-pipeline som kan brukes både til trening og til fremtidige prediksjoner.

Definisjon av "suksess":
- 1 (suksess) hvis:
    - status ∈ {acquired, ipo}, eller
    - status == operating OG alder >= MIN_OPERATING_YEARS (målt fra founded_at til last_funding_at)
- 0 (ikke suksess) hvis:
    - status ∈ {closed, shutdown, bankrupt, deadpooled}
- Rader med status == operating OG alder < MIN_OPERATING_YEARS droppes fra trening
  (vi vet ikke nok ennå om dem ⇒ "unknown outcome").
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, Pool
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split


# ---------------------------------------------------------------------------
# Konstanter / paths
# ---------------------------------------------------------------------------

DATA_PATH = "big_startup_secsees_dataset.csv"
MODEL_PATH = "catboost_startup_success.cbm"
METADATA_PATH = "preprocess_metadata.joblib"

RANDOM_STATE = 42
MIN_OPERATING_YEARS = 3  # kan tunes


# ---------------------------------------------------------------------------
# Metadata-objekt for preprocess
# ---------------------------------------------------------------------------

@dataclass
class PreprocessMetadata:
    """
    Holder info som trengs for å preprocess'e både trenings- og test-data på
    samme måte.
    """
    feature_cols: List[str]          # orden på features inn til modellen
    cat_features: List[str]          # navn på kategoriske features
    cat_feature_indices: List[int]   # indeksene til kategoriske features i feature_cols


# ---------------------------------------------------------------------------
# Hjelpefunksjoner for target / labels
# ---------------------------------------------------------------------------

def _parse_dates(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    """Parser dato-kolonner til datetime (in-place-kopi)."""
    df = df.copy()
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors="coerce")
    return df


def build_target(
    df: pd.DataFrame,
    min_operating_years: int = MIN_OPERATING_YEARS,
) -> Tuple[pd.Series, pd.Series]:
    """
    Lager target-variabelen 'success' og en maske for rader med ukjent utfall.

    Returnerer:
        success: pd.Series med 0/1 for henholdsvis ikke-suksess/suksess
        unknown_mask: pd.Series[bool] der True betyr: "Vi vet ikke utfallet ennå"
    """
    df = _parse_dates(df, ["founded_at", "last_funding_at"])

    status = df.get("status", pd.Series(index=df.index, dtype=object)).fillna("unknown")
    status = status.str.lower()

    # Alder (år) mellom founded_at og last_funding_at
    age_years = (df["last_funding_at"] - df["founded_at"]).dt.days / 365.25
    age_years = age_years.fillna(0)

    # Start med 0 overalt
    success = pd.Series(0, index=df.index, dtype=int)

    # 1 for acquired / ipo
    success[status.isin(["acquired", "ipo"])] = 1

    # 1 for operating OG gammel nok
    success[(status == "operating") & (age_years >= min_operating_years)] = 1

    # Operating + for ung => ukjent utfall (dropper disse i trening)
    unknown_mask = (status == "operating") & (age_years < min_operating_years)

    # Closed / shutdown / bankrupt / deadpooled er implisitt 0 (ikke suksess)
    # Andre rare statuser får bli 0 og ikke-unknown (kan evt. tunes senere).

    return success, unknown_mask


# ---------------------------------------------------------------------------
# Preprocess av features
# ---------------------------------------------------------------------------

def _extract_main_category(category_list_value: Any) -> str:
    """
    Tar første kategori fra 'category_list' (pipe-separert streng).
    """
    if isinstance(category_list_value, str) and category_list_value.strip():
        return category_list_value.split("|")[0].strip()
    return "Unknown"


def preprocess_features(
    df: pd.DataFrame,
    metadata: Optional[PreprocessMetadata] = None,
    is_train: bool = True,
) -> Tuple[pd.DataFrame, PreprocessMetadata]:
    """
    Gjør om rådata til feature-matrise som kan mates til CatBoost.

    - Bruker KUN features som er rimelig å anta at man kan kjenne til
      tidlig i selskapets livsløp:
        * funding_total_usd (og log-transform)
        * funding_rounds (antall runder totalt – her er det en viss
          fremtidsinfo, men langt mindre "lekkete" enn tid/varighets-features)
        * geografi: country_code, state_code, region, city
        * kategori: main_category (første kategori i 'category_list')
    - Bruker IKKE datoer eller avledede tidsdifferanser som input til modellen.

    Args:
        df: rådata (eller dict->DataFrame for enkel prediksjon)
        metadata: PreprocessMetadata fra trening (for test/prediksjon)
        is_train: True for trening, False for test/prediksjon

    Returns:
        X: feature-matrise
        metadata: PreprocessMetadata (ny ved trening, gjenbrukt ved test/prediksjon)
    """
    df = df.copy()

    # ---------- 1. Funding_total_usd → numerisk + log ----------
    if "funding_total_usd" in df.columns:
        df["funding_total_usd"] = (
            df["funding_total_usd"]
            .replace("-", np.nan)
            .replace("", np.nan)
        )
        df["funding_total_usd"] = pd.to_numeric(
            df["funding_total_usd"], errors="coerce"
        )

        # Log-transform for å jevne ut skjevhet
        df["funding_total_log"] = np.log1p(
            df["funding_total_usd"].fillna(0.0).clip(lower=0.0)
        )
    else:
        df["funding_total_usd"] = 0.0
        df["funding_total_log"] = 0.0

    # ---------- 2. funding_rounds ----------
    if "funding_rounds" in df.columns:
        df["funding_rounds"] = pd.to_numeric(
            df["funding_rounds"], errors="coerce"
        ).fillna(0).astype(float)
    else:
        df["funding_rounds"] = 0.0

    # ---------- 3. main_category fra category_list ----------
    if "category_list" in df.columns:
        df["main_category"] = df["category_list"].apply(_extract_main_category)
    else:
        df["main_category"] = "Unknown"

    # ---------- 4. Velg ut kolonner vi vil bruke som features ----------
    feature_candidates = [
        "funding_total_usd",
        "funding_total_log",
        "funding_rounds",
        "country_code",
        "state_code",
        "region",
        "city",
        "main_category",
    ]
    # Ta bare de som faktisk finnes i df (noen kan mangle)
    feature_cols = [c for c in feature_candidates if c in df.columns]

    df = df[feature_cols]

    # ---------- 5. Typing: kategori vs. numerisk ----------
    # Antakelse: alt som ikke er numerisk blir kategorisk.
    for col in df.columns:
        if df[col].dtype == "O":
            df[col] = df[col].fillna("Unknown").astype(str)

    num_cols = df.select_dtypes(exclude=["object"]).columns.tolist()
    df[num_cols] = df[num_cols].fillna(0.0)

    # ---------- 6. Metadata / kolonne-orden ----------
    if is_train:
        # Lås kolonne-rekkefølgen for modellen
        feature_cols = list(df.columns)

        # Kategoriske features = object-kolonner
        cat_features = df.select_dtypes(include=["object"]).columns.tolist()
        cat_feature_indices = [feature_cols.index(c) for c in cat_features]

        metadata = PreprocessMetadata(
            feature_cols=feature_cols,
            cat_features=cat_features,
            cat_feature_indices=cat_feature_indices,
        )
    else:
        if metadata is None:
            raise ValueError("metadata må gis når is_train=False")

        # Sørg for at alle feature_cols finnes, i riktig rekkefølge
        for col in metadata.feature_cols:
            if col not in df.columns:
                if col in metadata.cat_features:
                    df[col] = "Unknown"
                else:
                    df[col] = 0.0

        # Dropp eventuelle ekstra kolonner
        df = df[metadata.feature_cols]

        # Sørg for riktig dtype
        for col in metadata.cat_features:
            df[col] = df[col].fillna("Unknown").astype(str)

        for col in df.columns:
            if col not in metadata.cat_features:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    return df, metadata


# ---------------------------------------------------------------------------
# Trening av modell
# ---------------------------------------------------------------------------

def train_model(
    csv_path: str = DATA_PATH,
    model_path: str = MODEL_PATH,
    metadata_path: str = METADATA_PATH,
) -> Tuple[CatBoostClassifier, PreprocessMetadata]:
    """
    Leser data, bygger target, filtrerer ukjente utfall, preprocesser features
    og trener CatBoost-modell. Lagre modell + metadata til disk.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Fant ikke datasett: {csv_path}")

    print(f"Laster data fra {csv_path} ...")
    df_raw = pd.read_csv(csv_path, low_memory=False)

    print(f"Antall rader før filtrering: {len(df_raw)}")

    # Lag labels
    y_all, unknown_mask = build_target(df_raw, min_operating_years=MIN_OPERATING_YEARS)

    # Dropp rader med ukjent outcome
    mask_keep = ~unknown_mask
    df = df_raw[mask_keep].reset_index(drop=True)
    y = y_all[mask_keep].reset_index(drop=True)

    print(f"Antall rader etter at 'unknown outcome' er droppet: {len(df)}")
    print("Label-fordeling (0=failure, 1=success):")
    print(y.value_counts(normalize=True).sort_index())

    # Preprocess features
    X, metadata = preprocess_features(df, is_train=True)

    # Train/test-split
    X_train, X_valid, y_train, y_valid = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    train_pool = Pool(
        X_train,
        label=y_train,
        cat_features=metadata.cat_feature_indices,
    )
    valid_pool = Pool(
        X_valid,
        label=y_valid,
        cat_features=metadata.cat_feature_indices,
    )

    # CatBoost-hyperparametre – ganske konservative, med early stopping
    model = CatBoostClassifier(
        loss_function="Logloss",
        eval_metric="AUC",
        iterations=2000,
        learning_rate=0.03,
        depth=6,
        l2_leaf_reg=3.0,
        random_seed=RANDOM_STATE,
        border_count=128,
        auto_class_weights="Balanced",
        verbose=100,
        od_type="Iter",
        od_wait=50,  # early stopping
    )

    print("\nStarter trening av CatBoost-modell ...")
    model.fit(
        train_pool,
        eval_set=valid_pool,
        use_best_model=True,
    )

    # Evaluering
    y_valid_proba = model.predict_proba(valid_pool)[:, 1]
    auc = roc_auc_score(y_valid, y_valid_proba)
    y_valid_pred = (y_valid_proba >= 0.5).astype(int)

    print(f"\nValidation AUC: {auc:.4f}")
    print("\nClassification report (cutoff=0.5):")
    print(classification_report(y_valid, y_valid_pred, digits=3))

    # Lagre modell og metadata
    model.save_model(model_path)
    joblib.dump(metadata, metadata_path)

    print(f"\nModell lagret til: {model_path}")
    print(f"Preprocess-metadata lagret til: {metadata_path}")

    return model, metadata


# ---------------------------------------------------------------------------
# Prediksjon på nye startups
# ---------------------------------------------------------------------------

def load_trained_model_and_metadata(
    model_path: str = MODEL_PATH,
    metadata_path: str = METADATA_PATH,
) -> Tuple[CatBoostClassifier, PreprocessMetadata]:
    """
    Leser inn lagret CatBoost-modell og PreprocessMetadata.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Fant ikke modellfil: {model_path}")
    if not os.path.exists(metadata_path):
        raise FileNotFoundError(f"Fant ikke metadatafil: {metadata_path}")

    model = CatBoostClassifier()
    model.load_model(model_path)
    metadata: PreprocessMetadata = joblib.load(metadata_path)

    return model, metadata


def predict_success_score(
    startup_data: Dict[str, Any],
    model_path: str = MODEL_PATH,
    metadata_path: str = METADATA_PATH,
) -> Dict[str, Any]:
    """
    Tar et dictionary med input om en startup, preprocesser på samme måte
    som i trening, og returnerer en sannsynlighet for suksess.

    Eksempel på startup_data:
    {
        "funding_total_usd": "5000000",
        "funding_rounds": 3,
        "country_code": "USA",
        "state_code": "CA",
        "region": "San Francisco Bay Area",
        "city": "San Francisco",
        "category_list": "Software|Analytics",
    }
    """
    model, metadata = load_trained_model_and_metadata(
        model_path=model_path, metadata_path=metadata_path
    )

    df_input = pd.DataFrame([startup_data])
    X, _ = preprocess_features(df_input, metadata=metadata, is_train=False)

    pool = Pool(X, cat_features=metadata.cat_feature_indices)
    proba_success = float(model.predict_proba(pool)[0, 1])

    return {
        "success_probability": proba_success,
        "success_probability_percent": proba_success * 100.0,
    }


# ---------------------------------------------------------------------------
# CLI / enkel kjøring
# ---------------------------------------------------------------------------

def main() -> None:
    # Tren modellen
    model, metadata = train_model(
        csv_path=DATA_PATH,
        model_path=MODEL_PATH,
        metadata_path=METADATA_PATH,
    )

    # Eksempel-prediksjon på en hypotetisk startup
    example_startup = {
        "funding_total_usd": "5000000",
        "funding_rounds": 3,
        "country_code": "USA",
        "state_code": "CA",
        "region": "San Francisco Bay Area",
        "city": "San Francisco",
        "category_list": "Software|Analytics",
    }

    result = predict_success_score(
        example_startup,
        model_path=MODEL_PATH,
        metadata_path=METADATA_PATH,
    )

    print("\nEksempelprediksjon for startup:")
    print(example_startup)
    print("\nResultat:")
    print(
        f"Suksess-sannsynlighet: "
        f"{result['success_probability']:.3f} "
        f"({result['success_probability_percent']:.1f} %)"
    )


if __name__ == "__main__":
    main()
