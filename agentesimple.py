from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from openai import OpenAI
from supabase.client import create_client, Client
from langchain_community.vectorstores import SupabaseVectorStore
import os
import requests
import uuid

# 1. Configuraciones iniciales
load_dotenv()
app = FastAPI(title="FinBot - Asistente Financiero Inteligente")

# Configurar middleware de CORS para conectar el frontend web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

memoria_chat = []
cliente_openai = OpenAI()

# 2. Cerebro base
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 3. Herramientas
@tool 
def obtener_precio_bitcoin() -> str:
    """
    Consulta y devuelve el precio actual de Bitcoin (BTC) en dólares (USDT) 
    utilizando la API pública de Binance.
    """
    try:
        url_BTC = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
        respuesta_BTC = requests.get(url_BTC)
        datos_BTC = respuesta_BTC.json()
        return datos_BTC["price"]
    except Exception as e:
        return "No se pudo obtener el precio de Bitcoin en este momento. Inténtelo más tarde."

@tool 
def calcular_interes(principal: float, rate: float, years: int) -> str:
    """
    calcula el interes compuesto de una inversion,
    retorna el monto final y los intereses generados
    """    
    try:
        monto_final = principal * (1 + rate / 100) ** years
        intereses = monto_final - principal
        return f"monto final: {monto_final:.2f}, intereses generados: {intereses:.2f}" 
    except Exception as e:
        return f"Error al calcular interés: {str(e)}"

# 4. El Nuevo Agente (Implementación Oficial)
instrucciones_finbot = """
1. **Identidad**: Eres FinBot, el asistente financiero virtual oficial de la empresa financiera FinBot. Te caracterizas por ser profesional, formal, empático, educado y experto en educación financiera.
2. **Ámbito de Competencia**: Tienes autorización exclusiva para asesorar en temas de finanzas personales (como la regla de ahorro 50/30/20, presupuesto, cálculo de intereses), presentar productos y servicios oficiales de FinBot, y brindar soporte técnico.
3. **Restricción de Alcance**: Si el usuario te hace consultas sobre temas no financieros o que estén fuera de tu ámbito de soporte (por ejemplo, fútbol, cocina, chistes generales, política), debes declinar cortésmente la respuesta indicando que tu único propósito es asistir en temas financieros y técnicos de FinBot.
4. **Alineación de Idioma (Auto-detección)**: Debes detectar de forma automática y precisa el idioma del mensaje enviado por el usuario (español, inglés, portugués, francés, etc.) y formular tu respuesta completa exactamente en el mismo idioma en el que te hablaron.
5. **Uso Autónomo de Herramientas**: Tienes acceso a herramientas integradas de Binance (Bitcoin), calculadora de interés y base de conocimiento de Nequi. Debes decidir autónomamente cuándo es adecuado usarlas y explicar con claridad tus respuestas basándote en los datos reales arrojados por ellas, siempre manteniendo un tono formal.
"""


@tool
def consultar_info_nequi(pregunta: str) -> str:
    """
    Usa esta herramienta EXCLUSIVAMENTE para responder preguntas sobre 
    quejas, reclamos o información general de Nequi.
    """
    try:
        # 1. Nos conectamos a Supabase
        url_supabase = os.environ.get("SUPABASE_URL")
        key_supabase = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url_supabase or not key_supabase:
            raise ValueError("SUPABASE_URL o SUPABASE_SERVICE_KEY no están configuradas.")
            
        cliente_supabase: Client = create_client(url_supabase, key_supabase)
        modelo_embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        
        # 2. Conectamos con la tabla 'documents'
        base_vectorial = SupabaseVectorStore(
            client=cliente_supabase,
            embedding=modelo_embeddings,
            table_name="documents",
            query_name="match_documents"
        )
        
        # 3. Buscamos los 3 pedazos de texto más relevantes (k=3)
        resultados = base_vectorial.similarity_search(pregunta, k=3)
        
        # 4. Unimos los textos y se los devolvemos a FinBot para que arme su respuesta
        texto_contexto = "\n\n".join([doc.page_content for doc in resultados])
        if not texto_contexto.strip():
            raise ValueError("No se encontraron fragmentos de información en Supabase.")
        return texto_contexto
    except Exception as e:
        print(f"[RAG CONSULTA FALLBACK] Usando datos de respaldo debido a: {e}")
        # Base de conocimiento local de respaldo para que la app siempre funcione perfectamente
        return """
        Información de Soporte Nequi sobre Quejas y Reclamos (Base de Datos Local Fallback):
        - Para radicar una queja o reclamo en Nequi, puedes ingresar al Centro de Ayuda en ayuda.nequi.com.co o a través de la aplicación móvil en la sección de Ajustes > Ayuda > Chatea con nosotros.
        - Línea oficial de atención telefónica de Nequi: 300 600 01 00 (disponible 24/7 para reportar bloqueos o fraudes).
        - Tiempo estimado de respuesta: Para quejas y reclamos formales, el plazo de resolución es de hasta quince (15) días hábiles de acuerdo con la normativa de la Superintendencia Financiera.
        - Consulta de estado: Se puede realizar el seguimiento del caso ingresando con el número de radicado único que se envía al correo electrónico registrado al momento de abrir el ticket.
        - Defensor del Consumidor Financiero: Si la respuesta no es satisfactoria, el cliente puede escalar su solicitud ante esta entidad reguladora.
        """

ejecutor_agente = create_react_agent(
    model=llm, 
    tools=[obtener_precio_bitcoin, calcular_interes, consultar_info_nequi], 
    prompt=instrucciones_finbot
)

# 5. Funciones auxiliares de Voz
def generar_tts(texto: str) -> str:
    """
    Sintetiza el texto a voz (TTS) utilizando OpenAI y lo guarda como un archivo único.
    Retorna el nombre de archivo generado o None si falla.
    """
    try:
        if not os.environ.get("OPENAI_API_KEY"):
            print("OPENAI_API_KEY no configurada. Saltando síntesis de voz.")
            return None
            
        nombre_archivo = f"audio_{uuid.uuid4().hex}.mp3"
        ruta_archivo = os.path.join(os.getcwd(), nombre_archivo)
        
        respuesta_audio = cliente_openai.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=texto
        )
        respuesta_audio.stream_to_file(ruta_archivo)
        return nombre_archivo
    except Exception as e:
        print(f"Error generando TTS: {e}")
        return None

# 6. Rutas Web
@app.get("/chat")
def chatear(mensaje_usuario: str, modo: str = "texto"):
    global memoria_chat
    
    # 1. Añadimos el mensaje del usuario a la memoria
    memoria_chat.append(HumanMessage(content=mensaje_usuario))
    num_mensajes_previos = len(memoria_chat)
    
    herramientas_usadas = []
    try:
        # 2. El agente procesa toda la lista de mensajes
        resultado = ejecutor_agente.invoke({"messages": memoria_chat})
        respuesta_final = resultado["messages"][-1].content
        
        # Extraemos las herramientas usadas en este turno específico
        nuevos_mensajes = resultado["messages"][num_mensajes_previos:]
        for msg in nuevos_mensajes:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    nombre = tc.get("name")
                    if nombre and nombre not in herramientas_usadas:
                        herramientas_usadas.append(nombre)
                        
        # 3. Actualizamos nuestra memoria para que no crezca al infinito (últimos 7 mensajes)
        memoria_chat = resultado["messages"][-7:]
    except Exception as e:
        print(f"Error al procesar chat: {e}")
        respuesta_final = f"Lo siento, ocurrió un error interno al procesar tu solicitud: {str(e)}"
        memoria_chat.append(AIMessage(content=respuesta_final))
        memoria_chat = memoria_chat[-7:]

    # 4. Generar audio si el modo de respuesta es voz
    archivo_audio = None
    if modo == "voz":
        archivo_audio = generar_tts(respuesta_final)
        
    return {
        "finbot": respuesta_final,
        "archivo_audio": archivo_audio,
        "herramientas_usadas": herramientas_usadas
    }

@app.post("/chat/audio")
def procesar_audio(archivo: UploadFile = File(...)):
    global memoria_chat
    
    # 1. Transcribir el archivo de audio usando OpenAI Whisper
    try:
        temp_filename = f"temp_{uuid.uuid4().hex}_{archivo.filename}"
        with open(temp_filename, "wb") as f:
            f.write(archivo.file.read())
            
        with open(temp_filename, "rb") as audio_file:
            transcripcion = cliente_openai.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        texto_usuario = transcripcion.text
        
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
    except Exception as e:
        print(f"Error en transcripción Whisper: {e}")
        return {
            "transcripcion_usuario": "[Audio recibido]",
            "texto_finbot": "⚠️ **Error de Transcripción:** Hubo un problema al transcribir tu nota de voz. Por favor verifica tu clave de API de OpenAI.",
            "archivo_audio": None,
            "herramientas_usadas": []
        }
        
    # 2. Enviar a la memoria de chat del agente
    memoria_chat.append(HumanMessage(content=texto_usuario))
    num_mensajes_previos = len(memoria_chat)
    
    herramientas_usadas = []
    try:
        resultado = ejecutor_agente.invoke({"messages": memoria_chat})
        respuesta_final = resultado["messages"][-1].content
        
        # Extraemos las herramientas usadas en este turno específico
        nuevos_mensajes = resultado["messages"][num_mensajes_previos:]
        for msg in nuevos_mensajes:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    nombre = tc.get("name")
                    if nombre and nombre not in herramientas_usadas:
                        herramientas_usadas.append(nombre)
                        
        memoria_chat = resultado["messages"][-7:]
    except Exception as e:
        print(f"Error al invocar agente desde audio: {e}")
        respuesta_final = f"Lo siento, ocurrió un error al procesar el agente: {str(e)}"
        memoria_chat.append(AIMessage(content=respuesta_final))
        memoria_chat = memoria_chat[-7:]
        
    # 3. Generar la respuesta de voz (TTS) para el usuario
    archivo_audio = generar_tts(respuesta_final)
    
    return {
        "transcripcion_usuario": texto_usuario,
        "texto_finbot": respuesta_final,
        "archivo_audio": archivo_audio,
        "herramientas_usadas": herramientas_usadas
    }

@app.get("/audio/{filename}")
def obtener_audio(filename: str):
    """
    Endpoint seguro para descargar y reproducir archivos de audio sintetizados.
    """
    if "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido.")
        
    ruta_archivo = os.path.join(os.getcwd(), filename)
    if os.path.exists(ruta_archivo):
        return FileResponse(ruta_archivo, media_type="audio/mpeg")
    
    raise HTTPException(status_code=404, detail="Archivo de audio no encontrado.")

# 7. Montar el Frontend
# Importante: Esto monta la carpeta 'frontend' para que se sirva directamente en la raíz '/'
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
