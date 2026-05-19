# 🤖 FinBot - Asistente Financiero Inteligente (Voz & Herramientas)

¡Bienvenido a **FinBot**! Un asistente financiero inteligente con soporte de voz premium (Whisper & TTS), consultas a la API de Binance en tiempo real, calculadora de interés compuesto y una base de conocimientos RAG integrada de Nequi.

---

## 💻 1. Despliegue Local (Fácil y Rápido)

### Paso 1: Configurar variables de entorno
Crea o edita el archivo `.env` en la raíz de la carpeta y agrega tus claves reales:
```ini
SUPABASE_URL=https://fzkgjujdjeuqnissatjr.supabase.co
SUPABASE_SERVICE_KEY=tu_supabase_service_role_key
OPENAI_API_KEY=tu_openai_api_key
```

### Paso 2: Crear el entorno e instalar dependencias
Abre la terminal en la raíz del proyecto y ejecuta:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Paso 3: Levantar el servidor
Para correr el servidor FastAPI que también sirve el frontend unificado en el puerto `8000`:
```bash
uvicorn agentesimple:app --host 127.0.0.1 --port 8000 --reload
```
Abre en tu navegador: **`http://127.0.0.1:8000`** y ¡disfruta de la experiencia!

---

## ☁️ 2. Despliegue en Railway

Railway detectará la configuración automáticamente gracias a los archivos incluidos.

1. **`Procfile`:** Ya viene configurado en la raíz para arrancar la aplicación usando el puerto asignado por Railway:
   ```yaml
   web: uvicorn agentesimple:app --host 0.0.0.0 --port $PORT
   ```
2. **Variables de Entorno:**
   Al crear el servicio en el panel de Railway, añade las siguientes tres variables de entorno:
   * `OPENAI_API_KEY`
   * `SUPABASE_URL`
   * `SUPABASE_SERVICE_KEY`

¡Eso es todo! Tu aplicación estará en línea con HTTPS y lista para usarse.
