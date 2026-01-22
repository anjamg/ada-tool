/* ================= ERROR HANDLER & LOADING ================= */

window.ErrorHandler = {
    showError: function(message, duration = 5000) {
        const errorEl = document.getElementById("error-toast") || this.createErrorToast();
        errorEl.textContent = "❌ " + message;
        errorEl.classList.remove("hidden");
        
        clearTimeout(this.errorTimeout);
        this.errorTimeout = setTimeout(() => {
            errorEl.classList.add("hidden");
        }, duration);
    },

    createErrorToast: function() {
        const el = document.createElement("div");
        el.id = "error-toast";
        el.className = "toast error-toast hidden";
        el.style.cssText = "position: fixed; bottom: 1rem; right: 1rem; background: #ef4444; color: white; padding: 1rem; border-radius: 0.5rem; z-index: 9999; max-width: 400px; word-wrap: break-word;";
        document.body.appendChild(el);
        return el;
    }
};

window.LoadingHandler = {
    isLoading: false,

    show: function() {
        if (!this.isLoading) {
            this.isLoading = true;
            document.body.style.cursor = "wait";
            const loader = document.getElementById("loader") || this.createLoader();
            loader.classList.remove("hidden");
        }
    },

    hide: function() {
        if (this.isLoading) {
            this.isLoading = false;
            document.body.style.cursor = "auto";
            const loader = document.getElementById("loader");
            if (loader) loader.classList.add("hidden");
        }
    },

    createLoader: function() {
        const el = document.createElement("div");
        el.id = "loader";
        el.className = "loader hidden";
        el.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            text-align: center;
        `;
        el.innerHTML = `
            <div style="
                border: 4px solid #f3f3f3;
                border-top: 4px solid #2563eb;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            "></div>
            <p style="margin-top: 1rem; color: #666; font-weight: 500;">Chargement...</p>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(el);
        return el;
    }
};

// Wrapper pour les appels API avec gestion d'erreur
async function safeApiCall(apiFunction, ...args) {
    try {
        LoadingHandler.show();
        const result = await apiFunction(...args);
        LoadingHandler.hide();
        return result;
    } catch (error) {
        LoadingHandler.hide();
        const message = error.message || "Une erreur est survenue";
        ErrorHandler.showError(message);
        throw error;
    }
}
