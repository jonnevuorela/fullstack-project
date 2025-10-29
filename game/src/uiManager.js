export default class UIManager {
    constructor(game) {
        this.game = game;
        this.canvasContainer = document.getElementById("gameCanvas");

        this.overlay = null;
        this.overlayContent = null;
        this.spinnerOverlay = null;

        this.uiOverlay = null;
        this.uiDynamicContainer = null;

        this.RpmGaugeSvg = null;
        this.RpmGaugeNeedle = null;
        this.RpmGaugeValue = null;

        this.networkIcon = null;
        this.latencyElement = null;

        this.toastMessages = [];
        this.toastMessageContainer = null;

        this.debugLog = [];
        this.debugLogContainer = null;
        this.debugMode = false;
    }

    init() {
        this.initOverlay();
        this.initGameUI();
    }

    initOverlay() {
        if (!this.overlay) {
            this.overlay = document.createElement("div");
            this.overlay.className = "game-overlay";
            this.overlayContent = document.createElement("div");
            this.overlayContent.className = "overlay-content";
            this.overlay.appendChild(this.overlayContent);
            this.canvasContainer.appendChild(this.overlay);
        }
    }

    initGameUI() {
        if (!this.uiOverlay) {
            this.uiOverlay = document.createElement("div");
            this.uiOverlay.className = "game-ui";

            // AI genereoitu svg - locaali qwen3-coder-30b
            // the svg layout looks like what i want now, can you add marker lines aftear each 1000rpm and add redline to end
            this.uiOverlay.innerHTML = `
                <div class="rpm-meter">
                    <svg id="rpm-gauge" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r="95" fill="#222" stroke="#444" stroke-width="2"/>
                        <g id="tickMarks"></g>
                        <text x="100" y="180" text-anchor="middle" fill="#808080" font-size="18">RPM</text>
                        <text x="50" y="165" text-anchor="middle" fill="#808080" font-size="12">0</text>
                        <text x="160" y="90" text-anchor="middle" fill="#808080" font-size="12">8000</text>
                        <line id="rpm-needle" x1="100" y1="100" x2="100" y2="35" stroke="#f00" stroke-width="4"/>
                        <circle cx="100" cy="100" r="6" fill="#fff"/>
                    </svg>
                    <div id="rpm-value" style="text-align:center;font-size:16px;color:#fff;margin-top:6px;">0 RPM</div>
                </div>
                <div id="ui-dynamic"></div>
            `;

            this.canvasContainer.appendChild(this.uiOverlay);

            this.addTickMarks();
            this.uiDynamicContainer = this.uiOverlay.querySelector("#ui-dynamic");
            this.RpmGaugeSvg = this.uiOverlay.querySelector("#rpm-gauge");
            this.RpmGaugeNeedle = this.uiOverlay.querySelector("#rpm-needle");
            this.RpmGaugeValue = this.uiOverlay.querySelector("#rpm-value");
        }
    }

    // AI genereoitu svg - locaali qwen3-coder-30b
    // the svg layout looks like what i want now, can you add marker lines aftear each 1000rpm and add redline to end
    addTickMarks() {
        const tickContainer = document.getElementById("tickMarks");
        const maxRPM = 9500;
        const minRPM = 0;
        const sweep = 230;
        const base = -235;

        for (let i = 0; i <= maxRPM; i += 1000) {
            const angle = ((i - minRPM) / (maxRPM - minRPM)) * sweep;
            const theta = angle + base;

            const x1 = 100 + 85 * Math.cos((theta * Math.PI) / 180);
            const y1 = 100 + 85 * Math.sin((theta * Math.PI) / 180);
            const x2 = 100 + 95 * Math.cos((theta * Math.PI) / 180);
            const y2 = 100 + 95 * Math.sin((theta * Math.PI) / 180);

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", "#fff");
            line.setAttribute("stroke-width", "2");
            tickContainer.appendChild(line);
        }

        const angle = sweep + base;
        const rx1 = 100 + 85 * Math.cos((angle * Math.PI) / 180);
        const ry1 = 100 + 85 * Math.sin((angle * Math.PI) / 180);
        const rx2 = 100 + 95 * Math.cos((angle * Math.PI) / 180);
        const ry2 = 100 + 95 * Math.sin((angle * Math.PI) / 180);

        const redline = document.createElementNS("http://www.w3.org/2000/svg", "line");
        redline.setAttribute("x1", rx1);
        redline.setAttribute("y1", ry1);
        redline.setAttribute("x2", rx2);
        redline.setAttribute("y2", ry2);
        redline.setAttribute("stroke", "red");
        redline.setAttribute("stroke-width", "3");
        tickContainer.appendChild(redline);
    }

    // AI genereoitu svg - locaali qwen3-coder-30b
    // the svg layout looks like what i want now, can you add marker lines aftear each 1000rpm and add redline to end
    updateRpmGauge(currentRPM, maxRPM) {
        if (!this.RpmGaugeNeedle || !maxRPM) return;

        const rpm = Math.max(0, Math.min(currentRPM, maxRPM));
        const startAngle = -230;
        const endAngle = -20;
        const range = endAngle - startAngle;
        const normalized = rpm / maxRPM;
        const angle = startAngle + range * normalized;
        const rad = (angle * Math.PI) / 180;

        const centerX = 100, centerY = 100, needleLen = 65;
        const x2 = centerX + needleLen * Math.cos(rad);
        const y2 = centerY + needleLen * Math.sin(rad);

        this.RpmGaugeNeedle.setAttribute("x2", x2);
        this.RpmGaugeNeedle.setAttribute("y2", y2);

        if (this.RpmGaugeValue) {
            this.RpmGaugeValue.textContent = `${Math.round(rpm)} RPM`;
        }
    }

    showNetworkIcon() {
        this.initOverlay();
        let container = this.overlayContent.querySelector(".network-status-container");

        if (!container) {
            container = document.createElement("div");
            container.className = "network-status-container";
            this.overlayContent.appendChild(container);

            const icon = document.createElement("div");
            icon.className = "network-status-icon";
            container.appendChild(icon);
            this.networkIcon = icon;

            const latencyElement = document.createElement("div");
            latencyElement.className = "latency-text";
            latencyElement.textContent = "0ms";
            container.appendChild(latencyElement);
            this.latencyElement = latencyElement;
        }
    }

    updateNetworkStatus(state, latency) {
        this.showNetworkIcon();

        const NetworkState = {
            CONNECTED: 0,
            DISCONNECTED: 1,
            CONNECTING: 2,
        };

        let color = "#808080";
        if (state === NetworkState.CONNECTING) {
            color = "#edc001";
        } else if (state === NetworkState.CONNECTED) {
            color = "#0b6623";
        } else if (state === NetworkState.DISCONNECTED) {
            color = "#ed4337";
        }

        document.documentElement.style.setProperty('--network-status-color', color);

        if (this.latencyElement) {
            this.latencyElement.textContent = `${Math.round(latency)}ms`;
        }
    }

    showSpinner() {
        if (!this.spinnerOverlay) {
            this.spinnerOverlay = document.createElement("div");
            this.spinnerOverlay.className = "spinner-overlay";
            const spinner = document.createElement("div");
            spinner.className = "spinner";
            this.spinnerOverlay.appendChild(spinner);
            this.canvasContainer.appendChild(this.spinnerOverlay);
        }
    }

    hideSpinner() {
        if (this.spinnerOverlay) {
            this.spinnerOverlay.remove();
            this.spinnerOverlay = null;
        }
    }

    showError(message) {
        this.initOverlay();
        this.overlayContent.innerHTML = `<div class="overlay-error">${message || "An error occurred."}</div>`;
    }

    clearError() {
        this.initOverlay();
        const errors = this.overlayContent.querySelectorAll(".overlay-error");
        errors.forEach(error => error.remove());
    }

    addToastMessage(message, ttl = 10) {
        this.toastMessages.push(message);
        this.renderToastMessages();

        if (this.game.audioGloabal && this.game.soundEffects.toast) {
            const sound = this.game.audioGloabal;
            sound.setBuffer(this.game.soundEffects.toast);
            sound.setLoop(false);
            sound.setVolume(0.5);
            sound.play();
        }

        setTimeout(() => {
            const idx = this.toastMessages.indexOf(message);
            if (idx !== -1) {
                this.toastMessages.splice(idx, 1);
                this.renderToastMessages();
            }
        }, ttl * 1000);
    }

    renderToastMessages() {
        if (!this.toastMessageContainer) {
            this.toastMessageContainer = document.createElement("div");
            this.toastMessageContainer.className = "toast-log";
            this.canvasContainer.appendChild(this.toastMessageContainer);
        }

        this.toastMessageContainer.innerHTML = this.toastMessages
            .map(message => `
                <div>
                    <span class="toast-log-entry">${message}</span>
                </div>
            `)
            .join("");
        this.toastMessageContainer.scrollTop = this.toastMessageContainer.scrollHeight;
    }

    addDebugLog(type, text, ttl = 5) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", { hour12: false });
        const entry = { type, text, time: timeStr, ttl };

        this.debugLog.push(entry);
        this.renderDebugLog();
        console.log(`${type}: ${text}`);

        setTimeout(() => {
            const idx = this.debugLog.indexOf(entry);
            if (idx !== -1) {
                this.debugLog.splice(idx, 1);
                this.renderDebugLog();
            }
        }, ttl * 1000);
    }

    renderDebugLog() {
        if (this.debugMode) {
            if (!this.debugLogContainer) {
                this.debugLogContainer = document.createElement("div");
                this.debugLogContainer.className = "debug-log";
                this.canvasContainer.appendChild(this.debugLogContainer);
            }

            this.debugLogContainer.innerHTML = this.debugLog
                .map(entry => `
                    <div class="debug-log-entry debug-${entry.type}">
                        <span class="debug-time">${entry.time}</span>
                        <span class="debug-text">${entry.text}</span>
                    </div>
                `)
                .join("");
            this.debugLogContainer.scrollTop = this.debugLogContainer.scrollHeight;
        } else if (this.debugLogContainer) {
            this.debugLogContainer.remove();
            this.debugLogContainer = null;
        }
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        this.renderDebugLog();
        this.addDebugLog("info", `Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`, 3);
    }

    addUiElement(htmlOrNode, ttl = null) {
        let node;
        if (typeof htmlOrNode === "string") {
            node = document.createElement("div");
            node.innerHTML = htmlOrNode;
            node = node.firstElementChild || node;
        } else {
            node = htmlOrNode;
        }

        const closeBtn = node.querySelector(".close-pop");
        if (closeBtn) {
            closeBtn.onclick = () => {
                if (node.parentNode) node.parentNode.removeChild(node);
            };
        }

        this.uiDynamicContainer.appendChild(node);

        if (ttl && typeof ttl === "number" && ttl > 0) {
            setTimeout(() => {
                if (node.parentNode === this.uiDynamicContainer) {
                    this.uiDynamicContainer.removeChild(node);
                }
            }, ttl * 1000);
        }

        return node;
    }

    setState(state, errorMessage) {
        const State = {
            READY: 0,
            ERROR: 1,
            LOADING: 2,
        };

        this.initOverlay();

        if (state === State.LOADING) {
            this.showSpinner();
            this.clearError();
        } else if (state === State.ERROR) {
            this.hideSpinner();
            this.showError(errorMessage);

            let logMsg = "";
            if (errorMessage instanceof Error) {
                logMsg = errorMessage.message;
            } else {
                logMsg = errorMessage || "An error occurred.";
            }
            this.addDebugLog("error", logMsg);
        } else if (state === State.READY) {
            this.hideSpinner();
            this.clearError();
        }
    }
}
