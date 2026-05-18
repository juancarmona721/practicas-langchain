import os
from dotenv import load_dotenv
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from supabase.client import create_client, Client

# Cargar variables de entorno (busca el .env en la carpeta raíz)
load_dotenv()

# 1. Configurar cliente de Supabase
url_supabase = os.environ.get("SUPABASE_URL")
key_supabase = os.environ.get("SUPABASE_SERVICE_KEY")
cliente_supabase: Client = create_client(url_supabase, key_supabase)

# 2. Extracción (Scraping)
url_nequi = "https://ayuda.nequi.com.co/hc/es/articles/35778629531533--C%C3%B3mo-ver-el-estado-de-quejas-y-reclamos-en-Nequi"
cargador = WebBaseLoader(url_nequi)
documento_completo = cargador.load()
print("1. Documento extraído correctamente.")

# 3. División (Chunking)
# Cortamos en pedazos de 500 caracteres, con un solapamiento de 50
divisor = RecursiveCharacterTextSplitter(
    chunk_size=500, 
    chunk_overlap=50
)
pedazos = divisor.split_documents(documento_completo)
print(f"2. Texto dividido en {len(pedazos)} chunks.")

# 4. Vectorización y Almacenamiento en la Nube
print("3. Generando vectores y subiendo a Supabase...")
modelo_embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Insertamos los documentos y sus embeddings en la tabla 'documents' de Supabase
base_vectorial = SupabaseVectorStore.from_documents(
    documents=pedazos,
    embedding=modelo_embeddings,
    client=cliente_supabase,
    table_name="documents",
    query_name="match_documents"
)

print("4. ¡Éxito! Base de conocimiento cargada en Supabase.")