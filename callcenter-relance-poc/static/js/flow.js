(function(){
    const stepLead = document.getElementById("step-lead");
    const stepCall = document.getElementById("step-call");
    const stepRelance = document.getElementById("step-relance");

    const toast = document.getElementById("toast");

    let mode = "create";        // "create" | "edit_relance"
    let leadId = null;
    let editingCallId = null;

    function enable(step){ step.classList.remove("disabled"); step.classList.add("active"); }
    function lock(step){ step.classList.remove("active"); }
    function showToast(msg){
        toast.textContent = msg;
        toast.style.display = "block";
        setTimeout(()=>toast.style.display="none", 1500);
    }

    function updatePhoneLink(){
        const n = phone.value.trim();
        if(n){
            phoneLink.textContent = n;
            phoneLink.href = `tel:${n}`;
        } else {
            phoneLink.textContent = "—";
            phoneLink.href = "#";
        }
    }

    // default relance = none, date prefill
    const relanceLevel = document.getElementById("relance_level");
    const relanceAt = document.getElementById("relance_at");
    const relancePrio = document.getElementById("relance_priority");

    function applyRelanceUI(){
        const none = relanceLevel.value === "none";
        relancePrio.disabled = none;
        relanceAt.disabled = none;
        if(none){
            relancePrio.value = "NORMAL";
        } else {
            if(!relanceAt.value){
                relanceAt.value = toLocalInputValue(computeNextCallDate(new Date()));
            }
            // si résultat "A rappeler" => P1 par défaut
            if(result.value === "A rappeler") relancePrio.value = "P1";
        }
    }

    relanceLevel.addEventListener("change", applyRelanceUI);

    // order Appel: conseiller / type / aircall / résultat
    result.addEventListener("change", ()=>{
        if(result.value === "A rappeler" && relanceLevel.value !== "none"){
            relancePrio.value = "P1";
        }
    });

    // Step 1: create lead (no phone)
    btnLeadNext.addEventListener("click", async ()=>{
        const payload = {
            projet: projet.value,
            type_lead: type_lead.value,
            lead_key: lead_key.value.trim(),
            lead_created_at: lead_created_at.value.trim()
        };

        if(!payload.lead_key) return alert("Clé du lead requise");
        if(!payload.lead_created_at) return alert("Date création lead requise (DD/MM/YYYY HH:mm)");

        try{
            const res = await api.createLead(payload);
            leadId = res.lead_id;

            lock(stepLead);
            enable(stepCall);

        }catch(e){
            alert("Erreur lead");
        }
    });

    // Step 2: go relance (requires phone from aircall in create mode)
    btnCallNext.addEventListener("click", ()=>{
        if(mode === "create"){
            if(!phone.value.trim()) return alert("Appelez via Aircall pour récupérer le numéro");
        }
        lock(stepCall);
        enable(stepRelance);

        // default relance date
        if(!relanceAt.value) relanceAt.value = toLocalInputValue(computeNextCallDate(new Date()));
        applyRelanceUI();
    });

    // Save: create action OR complete relance edit
    btnSave.addEventListener("click", async ()=>{
        if(!leadId) return alert("Lead non créé");

        const phoneVal = phone.value.trim();
        if(!phoneVal) return alert("Numéro manquant");

        // If "Qualifié / Annulé / Pas intéressé" => default none relance
        if(["Qualifié","Annulé","Pas intéressé"].includes(result.value)){
            relanceLevel.value = "none";
            applyRelanceUI();
        }

        try{
            if(mode === "create"){
                await api.saveAction({
                    lead_id: leadId,
                    phone: phoneVal,
                    agent: agent.value,
                    attempt_level: attempt_level.value,
                    result: result.value,
                    priority: "NORMAL",
                    relance_level: relanceLevel.value,
                    relance_at: relanceLevel.value === "none" ? null : relanceAt.value,
                    relance_priority: relanceLevel.value === "none" ? "NORMAL" : relancePrio.value
                });
                showToast("✅ Appel enregistré");
            } else {
                await api.completeRelance(editingCallId, {
                    result: result.value,
                    priority: "NORMAL",
                    relance_level: relanceLevel.value,
                    relance_at: relanceLevel.value === "none" ? null : relanceAt.value,
                    relance_priority: relanceLevel.value === "none" ? "NORMAL" : relancePrio.value
                });
                showToast("✅ Relance enregistrée");
            }

            // refresh views + reset process
            await window.__refreshAll?.();
            window.scrollTo({top:0, behavior:"smooth"});
            setTimeout(()=>window.location.reload(), 650);

        }catch(e){
            alert("Erreur enregistrement");
        }
    });

    // exposed: open edit-relance mode from Relances view
    window.openRelance = async function(callId){
        try{
            const ctx = await api.relanceContext(callId);
            mode = "edit_relance";
            editingCallId = callId;
            leadId = ctx.lead_id;

            // Fill lead (locked)
            projet.value = ctx.projet;
            type_lead.value = ctx.type_lead;
            lead_key.value = ctx.lead_key;
            lead_created_at.value = ctx.lead_created_at ? ctx.lead_created_at.replace("T"," ").slice(0,16) : "";
            // phone already known
            phone.value = ctx.phone || "";
            updatePhoneLink();

            // In edit: no Aircall button
            aircallBtn.style.display = "none";
            phone.removeAttribute("readonly");
            phone.setAttribute("readonly","readonly"); // stays readonly but filled
            // Appel: agent/type already known
            agent.value = ctx.agent;
            attempt_level.value = String(ctx.attempt_level);

            // Result default for completion
            result.value = "A rappeler";

            // Relance: keep existing planned date as default
            if(ctx.next_call_at){
                relanceAt.value = ctx.next_call_at.slice(0,16);
            } else {
                relanceAt.value = toLocalInputValue(computeNextCallDate(new Date()));
            }
            relanceLevel.value = "none";
            relancePrio.value = "NORMAL";
            applyRelanceUI();

            // Enable columns 2 & 3, lock lead
            lock(stepLead);
            enable(stepCall);
            enable(stepRelance);

        }catch(e){
            alert("Erreur ouverture relance");
        }
    };

    // init phone link
    updatePhoneLink();
    phone.addEventListener("input", updatePhoneLink);
})();
