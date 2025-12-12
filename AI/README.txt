# INSTALLERING AV MILJØ

1. Installer miniconda (du trenger Spyder og Anaconda Prompt)

2. Lag miljø i anaconda prompt etter installering:

conda create -n startup-ai python=3.10
conda activate startup-ai

pip install -r requirements.txt

Om det ikke funker - installer manuelt:

pip install streamlit pandas numpy scikit-learn catboost joblib requests

3. Laste ned ollama

https://ollama.com/download

Terminal-kommando: ollama pull llama3.1:8b

4. Kjøre AI:

Gi inn i "AI"-mappen ("cd" kommando i Anaconda prompt for å komme til mappen du pakket ut. Eksempel cd Desktop)

Aktiver miljø - Anaconda prompt kommando: conda activate startup-ai

Start streamlit-appen - terminal kommando: streamlit run app.py

### FORKLARING:

CatBoost-modellen er allerede trent gjennom *train_startup_model.py*
Ollama-parametere er satt under *ollama_explainer.py* (Kan endres på underveis). 
app.py er kun brukt som en template for deres frontend-implementasjon. 

Send melding om noe er uklart


