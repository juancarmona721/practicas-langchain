from starlette.responses import Content
from fastapi import FastAPI
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage


load_dotenv()
app = FastAPI()

llm = ChatOpenAI(model="gpt-4o-mini", temperature = 0)
memoria_chat = []

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt  = ChatPromptTemplate.from_messages([
    ("system", "Eres FinBot, un asistente virtual formal que responde siempre en el diioma que le  hablen, no importa  la peticion que sea y profesional de la empresa financiera FinBot. Solo debes responder a preguntas sobre finanzas personales, productos de FinBot y soporte técnico. Si te preguntan sobre otros temas, declina cortésmente. Always detect the language of each user message and respond in that same language."),
    MessagesPlaceholder(variable_name="historial_chat"),
    ("user", "{input}")
])

@app.get("/")
def leer_raiz():
    return {"mensaje": "finbot activo"}


@app.get("/chat")
def chatear(mensaje_usuario: str):
    global memoria_chat
    cadena = prompt | llm 
    resultado = cadena.invoke({"input": mensaje_usuario,  "historial_chat" : memoria_chat})
    
    memoria_chat.append(HumanMessage(content=mensaje_usuario))
    memoria_chat.append(AIMessage(content=resultado.content))

    
    memoria_chat = memoria_chat[-7:]

    return {"finbot": resultado.content}

 
