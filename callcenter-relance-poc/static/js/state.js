(function () {
    // Etat global minimal attendu par call-flow.js
    window.AppState = {
        lead: { id: null, projet: "", type: "", key: "", createdAt: "" },
        call: { agent: "", type: "", priority: "NORMAL", phone: "", result: "" },
        relance: { needed: false, level: "none", date: "", priority: "NORMAL" },
    };

    // Règles métier (utilisées par call-flow.js)
    window.RESULTS_FINAL = ["Qualifié", "Annulé", "Pas intéressé"];
    window.RESULTS_NEED_RELANCE = ["Pas de réponse", "Injoignable", "À rappeler"];

    // Wire Aircall button + init select relance_type
    function init() {
        const btnAircall = document.getElementById("btnAircall");
        if (btnAircall) {
            btnAircall.addEventListener("click", (e) => {
                e.preventDefault();
                if (typeof window.openAircall === "function") window.openAircall();
                else alert("Aircall non initialisé (openAircall introuvable)");
            });
        }

        // Remplit le select du modal (sinon il est vide)
        const relanceType = document.getElementById("relance_type");
        if (relanceType && relanceType.options.length === 0) {
            relanceType.appendChild(new Option("—", "none"));
            for (let i = 2; i <= 10; i++) relanceType.appendChild(new Option(`Relance ${i - 1}`, String(i)));
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
