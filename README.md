# FinBot - Smart Financial Assistant (Voice & Tools)

Welcome to **FinBot**! A smart financial assistant with premium voice support (Whisper & TTS), real-time Binance API queries, a compound interest calculator, and an integrated Nequi RAG knowledge base.


---

## 1. Local Deployment (Easy and Fast)

### Step 1: Configure Environment Variables
Create or edit the `.env` file in the root of the folder and add your actual keys:
```ini
SUPABASE_URL=https://fzkgjujdjeuqnissatjr.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

### Step 2: Create the Environment and Install Dependencies
Open the terminal in the project root and run:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Start the Server
To run the FastAPI server, which also serves the unified frontend, on port `8000`:
```bash
uvicorn agentesimple:app --host 127.0.0.1 --port 8000 --reload
```
Open in your browser: **`http://127.0.0.1:8000`** and enjoy the experience!

---

## 2. Deployment on Railway

Railway will automatically detect the configuration thanks to the included files.


1. **`Procfile`:** It's already configured in the root directory to start the application using the port assigned by Railway:
```yaml
web: uvicorn agentesimple:app --host 0.0.0.0 --port $PORT
```
2. **Environment Variables:**
When creating the service in the Railway panel, add the following three environment variables:

``OPENAI_API_KEY`

``SUPABASE_URL`

`SUPABASE_SERVICE_KEY`

That's it! Your application will be online with HTTPS and ready to use.