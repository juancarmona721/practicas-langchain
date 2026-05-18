/* -------------------------------------------------------------
   FINBOT FRONTEND INTERACTIVE CONTROLLER
   ------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar Iconos Lucide
    lucide.createIcons();

    // --- CONFIGURACIÓN DE CONEXIÓN BACKEND ---
    // Cambia 'usarMock' a 'false' una vez que quieras conectar con tu servidor de Python
    const CONFIG = {
        usarMock: true, 
        backendUrl: "http://localhost:8000" // Ajusta a tu puerto de FastAPI (por defecto 8000)
    };

    // --- SELECCIÓN DE ELEMENTOS DOM ---
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const chatMessages = document.getElementById("chat-messages");
    const welcomeCard = document.getElementById("welcome-card");
    const btnMic = document.getElementById("btn-mic");
    const btnSend = document.getElementById("btn-send");
    
    // Ticker BTC
    const btcPriceEl = document.getElementById("btc-price");
    const btcChangeEl = document.getElementById("btc-change");

    // Calculadora Sidebar
    const calcPrincipal = document.getElementById("calc-principal");
    const calcRate = document.getElementById("calc-rate");
    const calcYears = document.getElementById("calc-years");
    const btnRunCalc = document.getElementById("btn-run-calc");
    const calcResult = document.getElementById("calc-result");

    // Control de Grabación de Voz
    const voiceOverlay = document.getElementById("voice-overlay");
    const btnCancelVoice = document.getElementById("btn-cancel-voice");
    const btnSendVoice = document.getElementById("btn-send-voice");
    const voiceTimer = document.querySelector(".voice-timer");
    
    // Modal Informativo
    const backendInfoModal = document.getElementById("backend-info-modal");
    const btnToggleInfo = document.getElementById("btn-toggle-info");
    const btnCloseModal = document.getElementById("btn-close-modal");
    const btnClearChat = document.getElementById("btn-clear-chat");

    // --- VARIABLES DE ESTADO ---
    let grabacionInterval = null;
    let grabacionSegundos = 0;
    let btcActualPrice = "96,250.00"; // Fallback inicial

    // Auto-ajustar altura del textarea de chat al escribir
    userInput.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = (this.scrollHeight - 4) + "px";
        if (this.value.trim() !== "") {
            btnSend.style.opacity = "1";
        }
    });

    // --- 1. TICKER DE BITCOIN (Conexión Real en Tiempo Real via Binance API) ---
    async function actualizarPrecioBitcoin() {
        try {
            // Hacemos una consulta directa a la API pública de Binance para impresionar al usuario con datos reales
            const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
            if (response.ok) {
                const data = await response.json();
                const precioFloat = parseFloat(data.lastPrice);
                const cambioFloat = parseFloat(data.priceChangePercent);
                
                btcActualPrice = precioFloat.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                btcPriceEl.textContent = btcActualPrice;
                
                // Formatear porcentaje
                const prefijo = cambioFloat >= 0 ? "+" : "";
                btcChangeEl.textContent = `${prefijo}${cambioFloat.toFixed(2)}% hoy`;
                
                // Ajustar colores del indicador
                const parent = btcChangeEl.parentElement;
                if (cambioFloat >= 0) {
                    parent.className = "btc-change-indicator positive";
                } else {
                    parent.className = "btc-change-indicator negative";
                }
            }
        } catch (error) {
            console.error("Error obteniendo precio de Bitcoin:", error);
            // Fallback elegante
            btcPriceEl.textContent = "96,250.00";
            btcChangeEl.textContent = "+2.45% hoy";
        }
    }
    // Ejecutar al cargar y actualizar cada 10 segundos
    actualizarPrecioBitcoin();
    setInterval(actualizarPrecioBitcoin, 10000);

    // --- 2. CALCULADORA DE INTERÉS COMPUESTO (Local Sidebar) ---
    btnRunCalc.addEventListener("click", () => {
        const principal = parseFloat(calcPrincipal.value);
        const rate = parseFloat(calcRate.value);
        const years = parseInt(calcYears.value);

        if (isNaN(principal) || isNaN(rate) || isNaN(years)) {
            calcResult.innerHTML = `<span style="color: var(--color-danger)">Por favor, llena todos los campos con valores válidos.</span>`;
            calcResult.classList.remove("hidden");
            return;
        }

        // Fórmula: A = P(1 + r/n)^nt
        const montoFinal = principal * Math.pow((1 + (rate / 100)), years);
        const intereses = montoFinal - principal;

        calcResult.innerHTML = `
            <span class="calc-result-total">Monto Final: $${montoFinal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span>Intereses: $${intereses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">*Simulado con éxito (Refleja la fórmula de tu backend).</span>
        `;
        calcResult.classList.remove("hidden");
    });

    // --- 3. LÓGICA DE MENSAJES EN CHAT ---

    // Agregar mensaje visualmente en la zona de chat
    function agregarMensajeAlChat(remitente, texto, audioSrc = null) {
        // Ocultar tarjeta de bienvenida al primer mensaje
        if (welcomeCard) {
            welcomeCard.style.display = "none";
        }

        const now = new Date();
        const horaStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const messageRow = document.createElement("div");
        messageRow.className = `message-row ${remitente}`;

        let contenidoHTML = `
            <div class="message-bubble">
                <div class="message-text">${formatearTextoMarkdown(texto)}</div>
        `;

        // Si incluye audio (simulación de respuesta de voz)
        if (audioSrc) {
            contenidoHTML += `
                <div class="audio-player-container">
                    <button class="btn-play-audio" title="Reproducir respuesta">
                        <i data-lucide="play" class="play-icon"></i>
                    </button>
                    <div class="audio-progress-bar">
                        <div class="audio-progress"></div>
                    </div>
                    <span class="audio-time">0:04</span>
                </div>
            `;
        }

        contenidoHTML += `
                <span class="message-meta">${horaStr}</span>
            </div>
        `;

        messageRow.innerHTML = contenidoHTML;
        chatMessages.appendChild(messageRow);
        
        // Re-inicializar iconos dentro del nuevo mensaje
        lucide.createIcons();
        
        // Auto-scroll al final
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Registrar evento de audio si existe reproductor
        if (audioSrc) {
            const playBtn = messageRow.querySelector(".btn-play-audio");
            const progress = messageRow.querySelector(".audio-progress");
            let reproduciendo = false;
            
            playBtn.addEventListener("click", () => {
                reproduciendo = !reproduciendo;
                const icon = playBtn.querySelector("i");
                if (reproduciendo) {
                    icon.setAttribute("data-lucide", "pause");
                    progress.style.width = "100%";
                    progress.style.transition = "width 4s linear";
                    setTimeout(() => {
                        icon.setAttribute("data-lucide", "play");
                        progress.style.width = "0%";
                        progress.style.transition = "none";
                        reproduciendo = false;
                        lucide.createIcons();
                    }, 4000);
                } else {
                    icon.setAttribute("data-lucide", "play");
                    progress.style.width = "40%";
                    progress.style.transition = "var(--transition-fast)";
                }
                lucide.createIcons();
            });
        }
    }

    // Mostrar el indicador de "escribiendo..." de FinBot
    function mostrarIndicadorEscritura() {
        const typingIndicator = document.createElement("div");
        typingIndicator.id = "typing-indicator-wrapper";
        typingIndicator.className = "message-row agent";
        typingIndicator.innerHTML = `
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Quitar indicador de escritura
    function removerIndicadorEscritura() {
        const wrapper = document.getElementById("typing-indicator-wrapper");
        if (wrapper) {
            wrapper.remove();
        }
    }

    // Formateador simple de markdown para que las negritas y saltos se vean premium
    function formatearTextoMarkdown(texto) {
        return texto
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/\n/g, '<br>');
    }

    // --- 4. INTEGRACIÓN DIRECTA CON EL BACKEND FASTAPI (PYTHON) ---
    
    // Función para enviar mensaje de texto al backend FastAPI
    async function enviarMensajeAlBackend(mensaje) {
        if (CONFIG.usarMock) {
            return resolverMockRespuesta(mensaje);
        }

        try {
            // GET /chat?mensaje_usuario=...
            const url = `${CONFIG.backendUrl}/chat?mensaje_usuario=${encodeURIComponent(mensaje)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Error en la respuesta del backend");
            
            const data = await response.json();
            return data.finbot; // Retorna la respuesta del agente
        } catch (error) {
            console.error("Error contactando backend FastAPI:", error);
            return "⚠️ **Error de Conexión:** No se pudo conectar con el backend de Python en `localhost:8000`. Asegúrate de que `uvicorn agentesimple:app --reload` esté ejecutándose y que CORS esté habilitado en FastAPI.";
        }
    }

    // Función para enviar archivo de audio grabado al backend FastAPI
    async function enviarAudioAlBackend(audioBlob) {
        if (CONFIG.usarMock) {
            return {
                transcripcion: "Simulación de consulta por voz de prueba financiera.",
                respuesta: "He recibido tu consulta por nota de voz. Como tu asistente virtual FinBot, te confirmo que la transcripción es correcta y estoy listo para darte soporte sobre finanzas. Esta es una simulación visual premium.",
                conAudio: true
            };
        }

        try {
            // POST /chat/audio con FormData conteniendo el archivo
            const formData = new FormData();
            formData.append("archivo", audioBlob, "consulta_voz.wav");

            const response = await fetch(`${CONFIG.backendUrl}/chat/audio`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) throw new Error("Error al enviar audio al servidor");
            const data = await response.json();
            
            return {
                transcripcion: data.transcripcion_usuario,
                respuesta: data.texto_finbot,
                conAudio: true // Para simular la respuesta vocal
            };
        } catch (error) {
            console.error("Error al procesar audio en el servidor:", error);
            return {
                transcripcion: "[Audio enviado]",
                respuesta: "⚠️ **Error de audio en backend:** El servidor de audio no pudo procesar tu archivo. Verifica que tengas configuradas las API keys de OpenAI (para Whisper y TTS) y que tu FastAPI esté activo con CORS.",
                conAudio: false
            };
        }
    }

    // --- 5. LÓGICA DE SIMULACIONES MOCK (Para pruebas rápidas de Front) ---
    function resolverMockRespuesta(mensaje) {
        const msgLower = mensaje.toLowerCase();
        
        return new Promise((resolve) => {
            setTimeout(() => {
                if (msgLower.includes("bitcoin") || msgLower.includes("btc")) {
                    resolve(`El precio actual de **Bitcoin (BTC)** es de **$${btcActualPrice} USDT** según la API de Binance en tiempo real. 📈\n\n¿Te gustaría que hagamos una simulación de inversión compuesta o analicemos tendencias?`);
                } else if (msgLower.includes("interés") || msgLower.includes("calcula")) {
                    // Detectar si hay números para una respuesta inteligente
                    resolve(`¡Excelente pregunta sobre inversión! Utilizando la herramienta de **Interés Compuesto** de FinBot:\n\nSi inviertes un principal inicial con una tasa anual acumulativa, tus intereses generarán nuevos intereses a lo largo de los años. Puedes realizar cualquier simulación usando la calculadora integrada en el panel izquierdo de esta pantalla de manera instantánea.`);
                } else if (msgLower.includes("presupuesto") || msgLower.includes("ahorro")) {
                    resolve(`Para crear un presupuesto mensual altamente efectivo, te sugiero la **regla del 50/30/20**:\n\n*   **50%** para tus necesidades básicas (vivienda, servicios, comida).\n*   **30%** para tus gustos personales (entretenimiento, salidas).\n*   **20%** directo a tu fondo de ahorro o inversión.\n\n¿Tienes alguna meta de ahorro específica que quieras evaluar?`);
                } else if (msgLower.includes("productos") || msgLower.includes("herramientas") || msgLower.includes("finbot")) {
                    resolve(`En **FinBot** te ofrecemos diversas herramientas:\n1. **Consulta de Precios Cripto:** Precios en tiempo real integrados con mercados internacionales.\n2. **Calculador de Rendimiento Compuesto:** Para evaluar planes de inversión.\n3. **Asesoría de Ahorro Inteligente:** Consejos personalizados y adaptados a tu idioma actual.\n\nTodo esto controlado mediante nuestro orquestador financiero inteligente.`);
                } else {
                    resolve(`He recibido tu mensaje: "${mensaje}".\n\nComo tu asistente financiero **FinBot**, estoy aquí para ayudarte con cualquier consulta sobre finanzas personales, análisis de inversión o soporte técnico de nuestros servicios financieros.`);
                }
            }, 1200);
        });
    }

    // --- 6. EVENTOS DE ENVÍO DE FORMULARIO ---
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = userInput.value.trim();
        if (texto === "") return;

        // Limpiar entrada
        userInput.value = "";
        userInput.style.height = "auto";
        btnSend.style.opacity = "0.6";

        // 1. Mensaje del Usuario
        agregarMensajeAlChat("user", texto);

        // 2. Indicador de Escritura de FinBot
        mostrarIndicadorEscritura();

        // 3. Obtener Respuesta (Backend o Mock)
        const respuestaBot = await enviarMensajeAlBackend(texto);

        // 4. Remover Indicador y Mostrar Respuesta
        removerIndicadorEscritura();
        agregarMensajeAlChat("agent", respuestaBot);
    });

    // Permitir enviar con la tecla Enter (sin Shift)
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event("submit"));
        }
    });

    // Click en preguntas sugeridas de la tarjeta de bienvenida
    document.querySelectorAll(".suggestion-btn").forEach(button => {
        button.addEventListener("click", () => {
            const query = button.getAttribute("data-query");
            userInput.value = query;
            chatForm.dispatchEvent(new Event("submit"));
        });
    });

    // --- 7. SIMULACIÓN DE GRABACIÓN DE VOZ (MICROFONO) ---
    btnMic.addEventListener("click", () => {
        // Abrir panel de grabación de voz
        voiceOverlay.classList.remove("hidden");
        grabacionSegundos = 0;
        voiceTimer.textContent = "00:00";
        
        // Iniciar temporizador visual
        grabacionInterval = setInterval(() => {
            grabacionSegundos++;
            const minutos = Math.floor(grabacionSegundos / 60).toString().padStart(2, '0');
            const segundos = (grabacionSegundos % 60).toString().padStart(2, '0');
            voiceTimer.textContent = `${minutos}:${segundos}`;
        }, 1000);
    });

    // Cancelar Nota de Voz
    btnCancelVoice.addEventListener("click", () => {
        clearInterval(grabacionInterval);
        voiceOverlay.classList.add("hidden");
    });

    // Enviar Nota de Voz
    btnSendVoice.addEventListener("click", async () => {
        clearInterval(grabacionInterval);
        voiceOverlay.classList.add("hidden");

        // Simular que grabamos un blob de audio
        // 1. Mostrar que el usuario mandó una nota de voz en pantalla
        agregarMensajeAlChat("user", "🎤 [Nota de voz enviada - Procesando transcripción...]");
        
        // 2. Mostrar indicador de escritura
        mostrarIndicadorEscritura();

        // 3. Enviar al backend / mock
        const resultado = await enviarAudioAlBackend(null);

        // 4. Remover escritura
        removerIndicadorEscritura();

        // 5. Mostrar la transcripción que hizo Whisper
        const mensajeTrans = chatMessages.lastElementChild;
        if (mensajeTrans && mensajeTrans.classList.contains("user")) {
            mensajeTrans.querySelector(".message-text").innerHTML = `🎤 _"${resultado.transcripcion}"_`;
        }

        // 6. Mostrar respuesta vocal de FinBot
        agregarMensajeAlChat("agent", resultado.respuesta, resultado.conAudio);
    });

    // --- 8. ACCIONES DE ENCABEZADO ---

    // Limpiar Chat
    btnClearChat.addEventListener("click", () => {
        if (confirm("¿Estás seguro de que deseas limpiar el historial de conversación?")) {
            // Eliminar todas las filas de mensajes excepto la tarjeta de bienvenida
            const rows = chatMessages.querySelectorAll(".message-row");
            rows.forEach(row => row.remove());
            if (welcomeCard) {
                welcomeCard.style.display = "block";
            }
        }
    });

    // Modal de Código Backend
    btnToggleInfo.addEventListener("click", () => {
        backendInfoModal.classList.remove("hidden");
    });

    btnCloseModal.addEventListener("click", () => {
        backendInfoModal.classList.add("hidden");
    });

    // Cerrar modal al hacer click fuera de él
    window.addEventListener("click", (e) => {
        if (e.target === backendInfoModal) {
            backendInfoModal.classList.add("hidden");
        }
    });
});
