from fastapi import FastAPI
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from openai import OpenAI
from fastapi import UploadFile, File
import os
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from supabase.client import create_client, Client
import requests

# 1. Configuraciones iniciales
load_dotenv()
app = FastAPI()

# Configurar middleware de CORS para conectar el frontend web
from fastapi.middleware.cors import CORSMiddleware
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
    url_BTC = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
    respuesta_BTC = requests.get(url_BTC)
    datos_BTC = respuesta_BTC.json()
    return datos_BTC["price"]

@tool 
def calcular_interes(principal: float, rate: float, years: int) -> str:
    """
    calcula el interes compuesto de una inversion,
    retorna el monto final y los intereses  generados
    """    
    monto_final = principal * (1 + rate / 100) **years
    intereses= monto_final - principal
    return f"monto final: {monto_final:.2f}, intereses generados: {intereses:.2f}" 

# 4. El Nuevo Agente (Implementación Oficial)
instrucciones_finbot = "Eres FinBot, un asistente virtual formal que responde siempre en el idioma que le hablen, no importa la peticion que sea y profesional de la empresa financiera FinBot. Solo debes responder a preguntas sobre finanzas personales, productos de FinBot y soporte técnico. Si te preguntan sobre otros temas, declina cortésmente. Always detect the language of each user message and respond in that same language."



@tool
def consultar_info_nequi(pregunta: str) -> str:
    """
    Usa esta herramienta EXCLUSIVAMENTE para responder preguntas sobre 
    quejas, reclamos o información general de Nequi.
    """
    # 1. Nos conectamos a Supabase
    url_supabase = os.environ.get("SUPABASE_URL")
    key_supabase = os.environ.get("SUPABASE_SERVICE_KEY")
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
    return texto_contexto






ejecutor_agente = create_react_agent(
    model=llm, 
    # Agregamos consultar_info_nequi al final
    tools=[obtener_precio_bitcoin, calcular_interes, consultar_info_nequi], 
    prompt=instrucciones_finbot
)



# 5. Rutas Web
@app.get("/")
def leer_raiz():
    return {"mensaje": "finbot activo"}

@app.get("/chat")
def chatear(mensaje_usuario: str):
    global memoria_chat
    
    # 1. Añadimos el mensaje del usuario a la memoria
    memoria_chat.append(HumanMessage(content=mensaje_usuario))
    
    # 2. El agente procesa toda la lista de mensajes
    resultado = ejecutor_agente.invoke({"messages": memoria_chat})
    
    # 3. Extraemos solo el texto de la última respuesta de FinBot
    respuesta_final = resultado["messages"][-1].content
    
    # 4. Actualizamos nuestra memoria para que no crezca al infinito
    memoria_chat = resultado["messages"][-7:]
    
    return {"finbot": respuesta_final}



@app.post("/chat/audio")
def procesar_audio(archivo: UploadFile = File(...)):
    global memoria_chat
    transcripcion = cliente_openai.audio.transcriptions.create(
        model="whisper-1",
        file=(archivo.filename, archivo.file, archivo.content_type)
    )
    texto_usuario = transcripcion.text 
    
    # 2. ¿Qué sigue aquí?
    memoria_chat.append(HumanMessage(content=texto_usuario))

    resultado = ejecutor_agente.invoke({"messages": memoria_chat})
    respuesta_final = resultado ["messages"][-1].content


    memoria_chat.append(AIMessage(content=respuesta_final))
    memoria_chat = resultado[ "messages"][-7:]


    respuesta_audio = cliente_openai.audio.speech.create(
        model = "tts-1",
        voice = "nova",
        input=respuesta_final
    )

    ruta_audio_salida = "respuesta_finbot.mp3"
    respuesta_audio.stream_to_file(ruta_audio_salida)

    return{
        "transcripcion_usuario": texto_usuario,
        "texto_finbot": respuesta_final,
        "archivo_audio": ruta_audio_salida
    } 

