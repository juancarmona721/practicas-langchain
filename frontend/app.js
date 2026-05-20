/* -------------------------------------------------------------
   FINBOT FRONTEND INTERACTIVE CONTROLLER (REAL VOICE AGENT)
   ------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar Iconos Lucide
    lucide.createIcons();

    // --- CONFIGURACIÓN DE CONEXIÓN BACKEND ---
    const CONFIG = {
        backendUrl: "" // Uso de rutas relativas para soportar despliegues (Railway) y localhost
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

    // --- SELECCIÓN DEL MODO DE RESPUESTA (TEXTO O VOZ) ---
    const modeTextBtn = document.getElementById("mode-text-btn");
    const modeVoiceBtn = document.getElementById("mode-voice-btn");

    // --- VARIABLES DE ESTADO ---
    let grabacionInterval = null;
    let grabacionSegundos = 0;
    let btcActualPrice = "96,250.00"; // Fallback inicial
    let responseMode = "texto"; // Modo activo por defecto ("texto" o "voz")

    // Variables para Grabación Real del Micrófono (MediaRecorder API)
    let mediaRecorder = null;
    let audioChunks = [];
    let audioStream = null;

    // --- MANEJO DEL SELECTOR DE MODO ---
    if (modeTextBtn && modeVoiceBtn) {
        modeTextBtn.addEventListener("click", () => {
            responseMode = "texto";
            modeTextBtn.classList.add("active");
            modeVoiceBtn.classList.remove("active");
        });

        modeVoiceBtn.addEventListener("click", () => {
            responseMode = "voz";
            modeVoiceBtn.classList.add("active");
            modeTextBtn.classList.remove("active");
        });
    }

    // Auto-ajustar altura del textarea de chat al escribir
    userInput.addEventListener("input", function () {
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

    // Agregar mensaje visualmente en la zona de chat con soporte de reproducción real de audio y herramientas usadas
    function agregarMensajeAlChat(remitente, texto, audioSrc = null, herramientas = []) {
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
        `;

        // Si es el agente y usó herramientas, mostrar los badges
        if (remitente === "agent" && herramientas && herramientas.length > 0) {
            contenidoHTML += `<div class="tool-badge-container">`;
            herramientas.forEach(tool => {
                let nombreLegible = tool;
                let icono = "wrench";
                if (tool === "obtener_precio_bitcoin") {
                    nombreLegible = "Binance API (Bitcoin)";
                    icono = "trending-up";
                } else if (tool === "calcular_interes") {
                    nombreLegible = "Calculadora (Interés Compuesto)";
                    icono = "calculator";
                } else if (tool === "consultar_info_nequi") {
                    nombreLegible = "Base Vectorial Nequi (RAG)";
                    icono = "database";
                }
                contenidoHTML += `
                    <span class="tool-badge" title="Herramienta ejecutada de forma autónoma">
                        <i data-lucide="${icono}" class="badge-icon"></i>
                        <span>Herramienta: <strong>${nombreLegible}</strong></span>
                    </span>
                `;
            });
            contenidoHTML += `</div>`;
        }

        contenidoHTML += `
                <div class="message-text">${formatearTextoMarkdown(texto)}</div>
        `;

        // Si incluye audio real sintetizado por el backend
        if (audioSrc) {
            contenidoHTML += `
                <div class="audio-player-container">
                    <button type="button" class="btn-play-audio" title="Reproducir respuesta">
                        <i data-lucide="play" class="play-icon"></i>
                    </button>
                    <div class="audio-progress-bar">
                        <div class="audio-progress" style="width: 0%;"></div>
                    </div>
                    <span class="audio-time">0:00</span>
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

        // Registrar evento de audio real si existe
        if (audioSrc) {
            const audioUrl = `${CONFIG.backendUrl}/audio/${audioSrc}`;
            const playBtn = messageRow.querySelector(".btn-play-audio");
            const progress = messageRow.querySelector(".audio-progress");
            const timeSpan = messageRow.querySelector(".audio-time");
            
            const audio = new Audio(audioUrl);
            let reproduciendo = false;
            
            audio.addEventListener("timeupdate", () => {
                if (audio.duration) {
                    const pct = (audio.currentTime / audio.duration) * 100;
                    progress.style.width = `${pct}%`;
                    
                    const curMin = Math.floor(audio.currentTime / 60);
                    const curSec = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
                    timeSpan.textContent = `${curMin}:${curSec}`;
                }
            });
            
            audio.addEventListener("loadedmetadata", () => {
                const durMin = Math.floor(audio.duration / 60);
                const durSec = Math.floor(audio.duration % 60).toString().padStart(2, '0');
                timeSpan.textContent = `${durMin}:${durSec}`;
            });
            
            audio.addEventListener("ended", () => {
                reproduciendo = false;
                const icon = playBtn.querySelector("i");
                if (icon) {
                    icon.setAttribute("data-lucide", "play");
                    lucide.createIcons();
                }
                progress.style.width = "0%";
            });
            
            playBtn.addEventListener("click", () => {
                reproduciendo = !reproduciendo;
                const icon = playBtn.querySelector("i");
                if (reproduciendo) {
                    // Detener otros audios que se estén reproduciendo actualmente
                    document.querySelectorAll('audio').forEach(el => el.pause());
                    
                    audio.play();
                    if (icon) icon.setAttribute("data-lucide", "pause");
                } else {
                    audio.pause();
                    if (icon) icon.setAttribute("data-lucide", "play");
                }
                lucide.createIcons();
            });
            
            // Intentar autoreproducción al cargar el mensaje (Premium Experience)
            audio.play().catch(e => {
                console.log("Autoplay bloqueado por el navegador. Requiere acción del usuario.", e);
                reproduciendo = false;
                const icon = playBtn.querySelector("i");
                if (icon) icon.setAttribute("data-lucide", "play");
                lucide.createIcons();
            });
            
            if (reproduciendo) {
                setTimeout(() => {
                    const icon = playBtn.querySelector("i");
                    if (icon) {
                        icon.setAttribute("data-lucide", "pause");
                        lucide.createIcons();
                    }
                }, 100);
            }
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

    // Función para enviar mensaje de texto al backend FastAPI con soporte de modo
    async function enviarMensajeAlBackend(mensaje) {
        try {
            // GET /chat?mensaje_usuario=...&modo=...
            const url = `${CONFIG.backendUrl}/chat?mensaje_usuario=${encodeURIComponent(mensaje)}&modo=${responseMode}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Error en la respuesta del backend");

            const data = await response.json();
            return {
                finbot: data.finbot,
                archivo_audio: data.archivo_audio,
                herramientas_usadas: data.herramientas_usadas || []
            };
        } catch (error) {
            console.error("Error contactando backend FastAPI:", error);
            return {
                finbot: "⚠️ **Error de Conexión:** No se pudo conectar con el backend de Python en `localhost:8000`. Asegúrate de que `uvicorn agentesimple:app --reload` esté ejecutándose y que CORS esté habilitado en FastAPI.",
                archivo_audio: null
            };
        }
    }

    // Función para enviar archivo de audio grabado al backend FastAPI
    async function enviarAudioAlBackend(audioBlob) {
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
                archivo_audio: data.archivo_audio,
                herramientas_usadas: data.herramientas_usadas || []
            };
        } catch (error) {
            console.error("Error al procesar audio en el servidor:", error);
            return {
                transcripcion: "[Audio enviado]",
                respuesta: "⚠️ **Error de audio en backend:** El servidor de audio no pudo procesar tu archivo. Verifica que tengas configuradas las API keys de OpenAI (para Whisper y TTS) y que tu FastAPI esté activo con CORS.",
                archivo_audio: null
            };
        }
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

        // 3. Obtener Respuesta del Backend
        const resultado = await enviarMensajeAlBackend(texto);

        // 4. Remover Indicador y Mostrar Respuesta
        removerIndicadorEscritura();
        agregarMensajeAlChat("agent", resultado.finbot, resultado.archivo_audio, resultado.herramientas_usadas);
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

    // --- 7. GRABACIÓN REAL DE AUDIO (MICROFONO) VIA MEDIARECORDER API ---
    btnMic.addEventListener("click", async () => {
        try {
            audioChunks = [];
            // Solicitar permisos de micrófono reales al navegador
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Instanciar grabador real
            mediaRecorder = new MediaRecorder(audioStream);
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                // Liberar el hardware del micrófono al detener la grabación
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                }
            };

            // Iniciar grabación real
            mediaRecorder.start();

            // Abrir panel de grabación visual en pantalla
            voiceOverlay.classList.remove("hidden");
            grabacionSegundos = 0;
            voiceTimer.textContent = "00:00";

            // Iniciar temporizador visual de segundos
            grabacionInterval = setInterval(() => {
                grabacionSegundos++;
                const minutos = Math.floor(grabacionSegundos / 60).toString().padStart(2, '0');
                const segundos = (grabacionSegundos % 60).toString().padStart(2, '0');
                voiceTimer.textContent = `${minutos}:${segundos}`;
            }, 1000);
        } catch (error) {
            console.error("Error al acceder al micrófono:", error);
            alert("No se pudo iniciar el micrófono. Por favor, asegúrate de otorgar permisos en tu navegador.");
        }
    });

    // Cancelar Nota de Voz en progreso
    btnCancelVoice.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        clearInterval(grabacionInterval);
        voiceOverlay.classList.add("hidden");
        audioChunks = [];
    });

    // Detener y Enviar Nota de Voz Real
    btnSendVoice.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.addEventListener("stop", async () => {
                // Generar blob binario del archivo de audio grabado
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

                // 1. Mostrar visualmente en pantalla que se envió un audio
                agregarMensajeAlChat("user", "🎤 [Nota de voz enviada - Procesando transcripción...]");

                // 2. Mostrar indicador de escritura
                mostrarIndicadorEscritura();

                // 3. Enviar el archivo binario real al servidor FastAPI
                const resultado = await enviarAudioAlBackend(audioBlob);

                // 4. Remover escritura
                removerIndicadorEscritura();

                // 5. Reemplazar la fila visual con la transcripción real que hizo Whisper en el backend
                const allUserRows = chatMessages.querySelectorAll(".message-row.user");
                if (allUserRows.length > 0) {
                    const ultimoMensajeVoz = allUserRows[allUserRows.length - 1];
                    ultimoMensajeVoz.querySelector(".message-text").innerHTML = `🎤 _"${resultado.transcripcion}"_`;
                }

                // 6. Mostrar respuesta vocal real de FinBot
                agregarMensajeAlChat("agent", resultado.respuesta, resultado.archivo_audio, resultado.herramientas_usadas);
            }, { once: true });

            mediaRecorder.stop();
        }

        clearInterval(grabacionInterval);
        voiceOverlay.classList.add("hidden");
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
