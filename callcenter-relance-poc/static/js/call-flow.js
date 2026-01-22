(function () {

    const state = window.AppState;

    // DOM
    const colLead = document.getElementById("col-lead");
    const colCall = document.getElementById("col-call");

    const btnLeadValidate = document.getElementById("btnLeadValidate");
    const btnCallValidate = document.getElementById("btnCallValidate");

    const leadProjet = document.getElementById("lead_projet");
    const leadType = document.getElementById("lead_type");
    const leadKey = document.getElementById("lead_key");
    const leadCreatedAt = document.getElementById("lead_created_at");

    const callAgent = document.getElementById("call_agent");
    const callType = document.getElementById("call_type");
    const callPriority = document.getElementById("call_priority");
    const callResult = document.getElementById("call_result");
    const phoneDisplay = document.getElementById("call_phone");

    const relanceModal = document.getElementById("relanceModal");
    const relanceType = document.getElementById("relance_type");
    const relanceDate = document.getElementById("relance_date");
    const relancePriority = document.getElementById("relance_priority");
    const btnRelanceSave = document.getElementById("btnRelanceSave");

    // ---------- LEAD ----------
    btnLeadValidate.addEventListener("click", async () => {
        if (!leadKey.value.trim() || !leadCreatedAt.value.trim()) {
            alert("Clé et date requises");
            return;
        }

        try {
            const res = await api.createLead({
                projet: leadProjet.value,
                type_lead: leadType.value,
                lead_key: leadKey.value.trim(),
                lead_created_at: leadCreatedAt.value.trim()
            });

            state.lead.id = res.lead_id;
            state.lead.projet = leadProjet.value;
            state.lead.type = leadType.value;

            colLead.classList.add("disabled");
            colCall.classList.remove("disabled");
        } catch {
            alert("Erreur création lead");
        }
    });

    // ---------- APPEL ----------
    btnCallValidate.addEventListener("click", async () => {
        if (!phoneDisplay.textContent || phoneDisplay.textContent === "—") {
            alert("Veuillez appeler via Aircall");
            return;
        }

        state.call = {
            agent: callAgent.value,
            type: callType.value,
            priority: callPriority.value,
            phone: phoneDisplay.textContent,
            result: callResult.value
        };

        if (!state.call.agent || !state.call.type || !state.call.result) {
            alert("Champs appel incomplets");
            return;
        }

        if (window.RESULTS_FINAL.includes(state.call.result)) {
            await saveAction(false);
        } else if (window.RESULTS_NEED_RELANCE.includes(state.call.result)) {
            openRelance();
        } else {
            alert("Résultat non géré");
        }
    });

    // ---------- RELANCE ----------
    function openRelance() {
        const next = Number(state.call.type) + 1;
        relanceType.innerHTML = "";
        relanceType.appendChild(new Option(`Relance ${next - 1}`, String(next)));
        relancePriority.value = "NORMAL";
        relanceDate.value = toLocalInputValue(computeNextCallDate(new Date()));
        relanceModal.classList.remove("hidden");
    }

    btnRelanceSave.addEventListener("click", async () => {
        if (!relanceDate.value) {
            alert("Date requise");
            return;
        }
        await saveAction(true);
    });

    // ---------- SAVE ----------
    async function saveAction(withRelance) {
        try {
            await api.saveAction({
                lead_id: state.lead.id,
                phone: state.call.phone,
                agent: state.call.agent,
                attempt_level: state.call.type,
                result: state.call.result,
                priority: state.call.priority,
                relance_level: withRelance ? relanceType.value : "none",
                relance_at: withRelance ? relanceDate.value : null,
                relance_priority: withRelance ? relancePriority.value : "NORMAL"
            });

            success();
        } catch {
            alert("Erreur enregistrement");
        }
    }

    // ---------- SUCCESS (UNIQUE) ----------
    function success() {
        const t = document.getElementById("toast");
        if (t) {
            t.classList.remove("hidden");
            setTimeout(() => t.classList.add("hidden"), 1200);
        }
        setTimeout(() => location.reload(), 900);
    }

})();
