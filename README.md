# 🤖 FinBot - Asistente Financiero Inteligente (RAG & Multi-Agent)

¡Bienvenido a **FinBot**! Este es un proyecto de asistente virtual formal y profesional especializado en finanzas personales, soporte técnico de productos de la empresa, e integración de datos en tiempo real (como el precio de Bitcoin y simulaciones de interés compuesto) utilizando **LangChain**, **LangGraph**, **FastAPI**, **Supabase (Vector Database)** y **OpenAI**.

Este archivo contiene toda la información y requisitos necesarios para poner en marcha y operar este proyecto con éxito.

---

## 📋 Tabla de Contenidos
1. [Prerrequisitos del Sistema](#-prerrequisitos-del-sistema)
2. [Estructura del Proyecto](#-estructura-del-proyecto)
3. [Configuración del Entorno de Python](#-configuración-del-entorno-de-python)
4. [Configuración de Base de Datos (Supabase Vector Store)](#-configuración-de-base-de-datos-supabase-vector-store)
5. [Variables de Entorno (.env)](#-variables-de-entorno-env)
6. [Ingesta de Datos (Carga del RAG)](#-ingesta-de-datos-carga-del-rag)
7. [Ejecución del Backend (FastAPI)](#-ejecución-del-backend-fastapi)
8. [Ejecución del Frontend](#-ejecución-del-frontend)
9. [Nota Importante sobre CORS](#-nota-importante-sobre-cors)

---

## ⚙️ Prerrequisitos del Sistema

Para que este proyecto funcione correctamente en tu máquina local, necesitarás disponer de:

1. **Python 3.10 o superior** instalado en tu sistema.
2. **Una cuenta de Supabase** (para almacenar la base de conocimiento vectorial).
3. **Una clave de API de OpenAI (OpenAI API Key)** (para los modelos GPT, embeddings, Whisper de audio y TTS de voz).
4. **Un navegador moderno** para ejecutar la interfaz de usuario interactiva.
5. **Conexión a internet** activa para consumir las APIs externas (Binance, OpenAI, Supabase).

---

## 📂 Estructura del Proyecto

El repositorio está estructurado de la siguiente forma:

```bash
simualcro/
├── .env                  # Archivo de configuración confidencial con las API Keys (Excluido en .gitignore)
├── .gitignore            # Lista de archivos omitidos para Git
├── agentesimple.py       # Servidor Backend principal con FastAPI, LangChain y LangGraph
├── requirements.txt      # Dependencias y librerías de Python requeridas
├── RAG/
│   └── ingesta.py        # Script para hacer Web Scraping e ingesta de vectores en Supabase
├── frontend/
│   ├── index.html        # Estructura visual de la interfaz de chat interactiva
│   ├── styles.css        # Hoja de estilos premium y responsiva con animaciones
│   └── app.js            # Lógica interactiva y conexión de llamadas API al backend
└── venv/                 # Entorno virtual de Python aislado (Excluido en .gitignore)
```

---

## 🐍 Configuración del Entorno de Python

Sigue estos pasos para preparar tu entorno de desarrollo en Windows:

1. **Clonar o abrir el directorio del proyecto** en una terminal de PowerShell o CMD.
2. **Crear el Entorno Virtual (Virtual Environment)** (si no existe):
   ```powershell
   python -m venv venv
   ```
3. **Activar el Entorno Virtual**:
   * En PowerShell:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * En CMD:
     ```cmd
     .\venv\Scripts\activate.bat
     ```
4. **Instalar Dependencias**:
   Instala todas las librerías necesarias con el archivo `requirements.txt` que hemos configurado para ti:
   ```powershell
   pip install -r requirements.txt
   ```

---

## 🗄️ Configuración de Base de Datos (Supabase Vector Store)

FinBot utiliza **Supabase** junto con la extensión **pgvector** para realizar búsquedas semánticas (RAG) sobre quejas y reclamos de Nequi. 

Para configurar la base de datos de manera idónea, ve al panel de control SQL de tu proyecto en Supabase (SQL Editor) y ejecuta la siguiente query:

```sql
-- 1. Habilitar la extensión para trabajar con vectores de embeddings
create extension if not exists vector;

-- 2. Crear la tabla de documentos
create table documents (
  id bigserial primary key,
  content text,          -- Corresponde al page_content de LangChain
  metadata jsonb,        -- Corresponde a los metadatos de LangChain
  embedding vector(1536) -- Tamaño para el modelo 'text-embedding-3-small'
);

-- 3. Crear la función de coincidencia vectorial para búsqueda de similitud
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigserial,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## 🔑 Variables de Entorno (.env)

Crea un archivo llamado `.env` en la **raíz del proyecto** (donde se encuentra `agentesimple.py`). Este archivo debe tener el siguiente formato con tus respectivas credenciales:

```env
# Clave de OpenAI para Chat y Generación de Embeddings
OPENAI_API_KEY=tu_openai_api_key_aqui

# Credenciales de conexión de tu proyecto de Supabase
SUPABASE_URL=https://tu-proyecto-id.supabase.co
SUPABASE_SERVICE_KEY=tu_supabase_service_role_key_aqui
```

> [!IMPORTANT]
> **Nunca compartas ni subas tu archivo `.env` a GitHub.** El proyecto ya cuenta con un archivo `.gitignore` que evita que se suba accidentalmente.

---

## 📥 Ingesta de Datos (Carga del RAG)

Antes de realizar consultas sobre Nequi en el chatbot, debes poblar la base de datos vectorial de Supabase con información de soporte. El script de ingesta automatizada lee la web de soporte oficial de Nequi, divide el contenido en fragmentos y los sube vectorizados a tu tabla `documents`.

Ejecuta el script desde la raíz del proyecto con tu entorno virtual activo:

```powershell
python RAG/ingesta.py
```

Al finalizar exitosamente, deberías ver en tu consola:
```text
1. Documento extraído correctamente.
2. Texto dividido en X chunks.
3. Generando vectores y subiendo a Supabase...
4. ¡Éxito! Base de conocimiento cargada en Supabase.
```

---

## 🚀 Ejecución del Backend (FastAPI)

Una vez que el RAG está cargado y el `.env` está configurado, puedes iniciar el servidor de desarrollo del backend:

```powershell
uvicorn agentesimple:app --reload
```

* El backend se levantará por defecto en `http://localhost:8000`.
* Puedes acceder a la documentación interactiva en `http://localhost:8000/docs`.

---

## 🎨 Ejecución del Frontend

La interfaz de usuario de FinBot es un desarrollo web premium e interactivo con soporte de temas visuales, reproductor de audio dinámico y calculadora en tiempo real. 

### Para usarla localmente:
1. Abre el archivo `frontend/index.html` en cualquier navegador web moderno (puedes hacer doble clic sobre él o usar extensiones de tu editor de código como *Live Server*).
2. **Conexión con el Backend Real**:
   * Por defecto, el archivo `frontend/app.js` viene configurado en **Mock Mode** (`usarMock: true`) para pruebas rápidas sin servidor.
   * Para conectarlo con tu servidor de Python real que iniciaste en el paso anterior, abre `frontend/app.js` y en la línea **12** cambia `usarMock: true` a `false`:
     ```javascript
     const CONFIG = {
         usarMock: false, // 👈 Cambia aquí a false para conectar al backend real
         backendUrl: "http://localhost:8000"
     };
     ```
3. ¡Comienza a chatear! Puedes escribir en tu idioma o incluso probar el envío de audio para interactuar con Whisper y las capacidades de texto-a-voz de OpenAI.

---

## ⚠️ Nota Importante sobre CORS

Si conectas el frontend en modo real (`usarMock: false`) y tienes problemas para interactuar con el servidor, es posible que el navegador bloquee las solicitudes debido a las políticas de seguridad **CORS** de FastAPI.

Para solucionarlo de forma permanente, puedes añadir el middleware de CORS en tu archivo `agentesimple.py` importándolo y configurándolo después de definir `app = FastAPI()`:

```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Permitir llamadas del frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Puedes limitarlo a ["http://localhost"] o ["*"] para pruebas locales
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

¡Felicidades! Con esta guía tu ecosistema interactivo de **FinBot** estará listo para operar al 100% de su capacidad de manera segura y eficiente. 🚀
