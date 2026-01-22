function qs(params){
    const u = new URLSearchParams();
    Object.entries(params||{}).forEach(([k,v])=>{
        if(v !== undefined && v !== null && String(v).trim() !== "") u.set(k,String(v));
    });
    const s = u.toString();
    return s ? `?${s}` : "";
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || `HTTP ${response.status}`);
        }
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            throw new Error("Délai d'attente dépassé - vérifiez votre connexion");
        }
        throw error;
    }
}

window.api = {
    async createLead(payload){
        const r = await fetchWithTimeout("/lead", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify(payload)
        });
        return r.json();
    },

    async saveAction(payload){
        const r = await fetchWithTimeout("/action", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify(payload)
        });
        return r.json();
    },

    async listLeads(filters){
        const r = await fetchWithTimeout("/leads" + qs(filters));
        return r.json();
    },

    async listCalls(filters){
        const r = await fetchWithTimeout("/calls" + qs(filters));
        return r.json();
    },

    async dashboard(filters){
        const r = await fetchWithTimeout("/dashboard" + qs(filters));
        return r.json();
    },

    async relances(filters){
        const r = await fetchWithTimeout("/relances" + qs(filters));
        return r.json();
    },

    async relanceContext(callId){
        const r = await fetchWithTimeout(`/relance/${callId}`);
        return r.json();
    },

    async completeRelance(callId, payload){
        const r = await fetchWithTimeout(`/relance/${callId}/complete`, {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify(payload)
        });
        return r.json();
    }
};
