(function () {

    /* ================= CONFIGURATION AGENTS ================= */
    const AGENTS_BY_PROJECT = {
        "Colisée": ["Hyacinthe", "Yowan", "Lanto Faniry", "Patrick", "Sariaka", "Natacha", "Niaina", "Julio", "Virginie", "Luisa", "Tsiry", "Angelo", "Mira", "Mathieu", "Nardi"],
        "Nohée": ["Joy", "Maggy", "Nandrianina", "Boris", "Miora", "Aro", "Fazel", "Marielle", "Michael"]
    };

    function updateAgentFilter(projectValue) {
        const agentSelect = document.getElementById("f_agent");
        if (!agentSelect) return;

        // Sauvegarder la valeur actuelle
        const currentValue = agentSelect.value;

        // Vider le select
        agentSelect.innerHTML = '<option value="">Conseiller</option>';

        // Ajouter les agents selon le projet
        let agentsToShow = [];
        if (projectValue === "Colisée") {
            agentsToShow = AGENTS_BY_PROJECT["Colisée"] || [];
        } else if (projectValue === "Nohée") {
            agentsToShow = AGENTS_BY_PROJECT["Nohée"] || [];
        } else {
            // Par défaut, afficher tous les agents
            agentsToShow = [...new Set([
                ...AGENTS_BY_PROJECT["Colisée"],
                ...AGENTS_BY_PROJECT["Nohée"]
            ])];
        }

        // Ajouter les options
        agentsToShow.forEach(agent => {
            const option = new Option(agent, agent);
            agentSelect.appendChild(option);
        });

        // Restaurer la valeur si elle existe encore, sinon vider
        if (agentSelect.querySelector(`option[value="${currentValue}"]`)) {
            agentSelect.value = currentValue;
        } else {
            agentSelect.value = "";
        }
    }

    /* ================= RENDERERS ================= */

    /* ===== XSS SAFE TABLE BUILDERS ===== */
    function createTableRow(cells) {
        const tr = document.createElement("tr");
        cells.forEach(cell => {
            const td = document.createElement("td");
            if (cell instanceof HTMLElement) {
                td.appendChild(cell);
            } else {
                td.textContent = cell || "—";
            }
            tr.appendChild(td);
        });
        return tr;
    }

    function createElement(tag, text) {
        const el = document.createElement(tag);
        el.textContent = text || "—";
        return el;
    }

    async function renderDashboard() {
        const el = document.getElementById("view-dashboard");
        if (!el) return;

        try {
            LoadingHandler.show();
            const d = await api.dashboard({});
            LoadingHandler.hide();
            
            el.innerHTML = `
              <div class="kpis kpis-hero">
                <div class="kpi kpi-accent">
                  <div class="kpi-icon">⚡</div>
                  <div class="kpi-title">Réactivité moyenne</div>
                  <div class="kpi-value">${d.reactivite_mean_minutes ?? "—"} min</div>
                </div>
                <div class="kpi">
                  <div class="kpi-icon">💪</div>
                  <div class="kpi-title">Combativité</div>
                  <div class="kpi-value">${d.combativite_calls_per_lead}</div>
                </div>
              </div>`;
        } catch (error) {
            LoadingHandler.hide();
            ErrorHandler.showError("Impossible de charger le dashboard");
            console.error("renderDashboard error:", error);
        }
    }

    /* ===== AJOUT SAFE : format date FR ===== */
    function formatDateTimeFR(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        return d.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }) + " · " + d.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    /* ===== AJOUT SAFE : statut visuel ===== */
    function renderStatus(result) {
        if (!result) return `<span class="status neutral">—</span>`;
        const map = {
            "Qualifié": "success",
            "Pas intéressé": "danger",
            "Pas de réponse": "warning",
            "Injoignable": "warning",
            "À rappeler": "info",
            "Annulé": "neutral"
        };
        const cls = map[result] || "neutral";
        return `<span class="status ${cls}">${result}</span>`;
    }

    function formatCountdown(targetDate) {
        const now = Date.now();
        const diffMin = Math.round((targetDate.getTime() - now) / 60000);

        if (diffMin > 0) {
            return { label: `Dans ${diffMin} min`, cls: "countdown-ok", late: false };
        }
        if (diffMin === 0) {
            return { label: "À l’instant", cls: "countdown-now", late: false };
        }
        return { label: `Depuis ${Math.abs(diffMin)} min`, cls: "countdown-late", late: true };
    }

    function formatDateFR(d) {
        return d.toLocaleDateString("fr-FR", {
            weekday: "short",
            day: "numeric",
            month: "short"
        }) + " · " + d.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatHourFR(d) {
        return d.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    async function renderNow() {
        const body = document.getElementById("nowBody");
        if (!body) return;

        try {
            const projet = document.getElementById("f_project")?.value || "";
            const state = window.PaginationState.now;
            
            LoadingHandler.show();
            const response = await api.relances({ projet, page: state.page, limit: state.limit });
            LoadingHandler.hide();
            
            const rows = response.data || response;
            const totalPages = response.pages || 1;

            const fAgent = document.getElementById("f_agent")?.value || "";
            const fPrio = document.getElementById("f_prio")?.value || "";

            const filtered = rows
                .filter(r => (!fAgent || r.agent === fAgent) && (!fPrio || r.priority === fPrio))
                .map(r => {
                    const date = new Date(r.next_call_at);
                    const delayMin = Math.floor((Date.now() - date.getTime()) / 60000);
                    return { ...r, date, delayMin };
                })
                .sort((a, b) => b.delayMin - a.delayMin);

            body.innerHTML = "";
            filtered.forEach(r => {
                const cd = formatCountdown(r.date);
                const dateLabel = formatDateFR(r.date);
                const hourLabel = formatHourFR(r.date);

                const tr = document.createElement("tr");
                tr.className = `row-action ${cd.late ? "is-late" : ""}`;
                tr.setAttribute("data-call-id", r.call_id);

                const td1 = document.createElement("td");
                const countdownDiv = document.createElement("div");
                countdownDiv.className = `countdown ${cd.cls}`;
                countdownDiv.textContent = cd.label;
                const dateDiv = document.createElement("div");
                dateDiv.className = "countdown-date";
                dateDiv.textContent = dateLabel;
                td1.appendChild(countdownDiv);
                td1.appendChild(dateDiv);

                const td2 = document.createElement("td");
                td2.textContent = sanitize(r.projet);

                const td3 = document.createElement("td");
                const relanceDiv = document.createElement("div");
                relanceDiv.className = "relance-level";
                relanceDiv.textContent = `Relance ${r.attempt_level - 1}`;
                const timeDiv = document.createElement("div");
                timeDiv.className = "relance-time";
                timeDiv.textContent = `à ${hourLabel}`;
                td3.appendChild(relanceDiv);
                td3.appendChild(timeDiv);

                const td4 = document.createElement("td");
                td4.textContent = sanitize(r.priority);

                tr.appendChild(td1);
                tr.appendChild(td2);
                tr.appendChild(td3);
                tr.appendChild(td4);

                tr.addEventListener("click", () => {
                    openRelance(tr.getAttribute("data-call-id"));
                });

                body.appendChild(tr);
            });

            // Render pagination
            const paginationHtml = buildPaginationHTML(state, totalPages, renderNow);
            const paginationEl = document.getElementById("pagination-now");
            if (paginationEl) {
                paginationEl.innerHTML = paginationHtml;
                setupPaginationButtons("pagination-now", state, renderNow);
            }
        } catch (error) {
            LoadingHandler.hide();
            ErrorHandler.showError("Impossible de charger les relances");
            console.error("renderNow error:", error);
        }
    }

    async function renderLeads() {
        const body = document.getElementById("leadsBody");
        if (!body) return;

        try {
            const state = window.PaginationState.leads;
            LoadingHandler.show();
            const response = await api.listLeads({ page: state.page, limit: state.limit });
            LoadingHandler.hide();
            
            const rows = response.data || response;
            const totalPages = response.pages || 1;

            body.innerHTML = "";
            rows.forEach(r => {
                const tr = document.createElement("tr");
                
                const cells = [
                    sanitize(r.lead_key),
                    sanitize(r.projet),
                    sanitize(r.type_lead),
                    sanitize(r.phone || "—"),
                    renderStatus(r.last_result),
                    String(r.call_count || 0),
                    sanitize((r.reactivity_minutes ?? "—") + " min"),
                    formatDateTimeFR(r.lead_created_at)
                ];

                cells.forEach(cell => {
                    const td = document.createElement("td");
                    if (cell instanceof HTMLElement) {
                        td.appendChild(cell);
                    } else if (typeof cell === "string" && cell.includes("<span")) {
                        td.innerHTML = cell;
                    } else {
                        td.textContent = cell || "—";
                    }
                    tr.appendChild(td);
                });

                body.appendChild(tr);
            });

            // Render pagination
            const paginationHtml = buildPaginationHTML(state, totalPages, renderLeads);
            const paginationEl = document.getElementById("pagination-leads");
            if (paginationEl) {
                paginationEl.innerHTML = paginationHtml;
                setupPaginationButtons("pagination-leads", state, renderLeads);
            }
        } catch (error) {
            LoadingHandler.hide();
            ErrorHandler.showError("Impossible de charger les leads");
            console.error("renderLeads error:", error);
        }
    }

    async function renderCalls() {
        const body = document.getElementById("callsBody");
        if (!body) return;

        try {
            const state = window.PaginationState.calls;
            LoadingHandler.show();
            const response = await api.listCalls({ page: state.page, limit: state.limit });
            LoadingHandler.hide();
            
            const rows = response.data || response;
            const totalPages = response.pages || 1;

            body.innerHTML = "";
            rows.forEach(r => {
                const tr = document.createElement("tr");
                
                const cells = [
                    sanitize(r.lead_key),
                    sanitize(r.projet),
                    sanitize(r.type_lead),
                    sanitize(r.phone || "—"),
                    sanitize(r.agent),
                    String(r.attempt_level || 0),
                    renderStatus(r.result),
                    sanitize(r.priority),
                    formatDateTimeFR(r.done_at)
                ];

                cells.forEach(cell => {
                    const td = document.createElement("td");
                    if (cell instanceof HTMLElement) {
                        td.appendChild(cell);
                    } else if (typeof cell === "string" && cell.includes("<span")) {
                        td.innerHTML = cell;
                    } else {
                        td.textContent = cell || "—";
                    }
                    tr.appendChild(td);
                });

                body.appendChild(tr);
            });

            // Render pagination
            const paginationHtml = buildPaginationHTML(state, totalPages, renderCalls);
            const paginationEl = document.getElementById("pagination-calls");
            if (paginationEl) {
                paginationEl.innerHTML = paginationHtml;
                setupPaginationButtons("pagination-calls", state, renderCalls);
            }
        } catch (error) {
            LoadingHandler.hide();
            ErrorHandler.showError("Impossible de charger les appels");
            console.error("renderCalls error:", error);
        }
    }

    async function openRelance(callId) {
        const ctx = await api.relanceContext(callId);

        document.querySelector('[data-target="prod"]')?.click();

        document.getElementById("lead_projet").value = ctx.projet;
        document.getElementById("lead_type").value = ctx.type_lead;
        document.getElementById("lead_key").value = ctx.lead_key;
        document.getElementById("lead_created_at").value =
            new Date(ctx.lead_created_at).toLocaleString("fr-FR").replace(",", "");

        document.getElementById("col-lead").classList.add("disabled");
        document.getElementById("col-call").classList.remove("disabled");

        window.AppState.lead.id = ctx.lead_id;

        document.getElementById("call_agent").value = ctx.agent;
        document.getElementById("call_type").value = String(ctx.attempt_level);
        document.getElementById("call_priority").value = ctx.priority;
        document.getElementById("call_phone").textContent = ctx.phone || "—";

        window.AppState.call.agent = ctx.agent;
        window.AppState.call.type = String(ctx.attempt_level);
        window.AppState.call.priority = ctx.priority;
        window.AppState.call.phone = ctx.phone || "";
    }

    document.getElementById("call_type").disabled = true;

    window.__refreshAll = function () {
        renderDashboard();
        renderNow();
        renderLeads();
        renderCalls();
    };

    function bindMainTabs() {
        const tabs = document.querySelectorAll(".main-tab");

        function show(target) {
            document.getElementById("section-prod")?.classList.toggle("hidden", target !== "prod");
            ["now", "dashboard", "leads", "calls"].forEach(id => {
                const el = document.getElementById(`view-${id}`);
                if (el) el.classList.toggle("hidden", target !== id);
            });
        }

        tabs.forEach(b => {
            b.addEventListener("click", () => {
                tabs.forEach(x => x.classList.remove("active"));
                b.classList.add("active");
                show(b.dataset.target);
                
                // Reset pagination to page 1 when changing tab
                window.PaginationState.now.page = 1;
                window.PaginationState.leads.page = 1;
                window.PaginationState.calls.page = 1;
                
                window.__refreshAll();
            });
        });

        show("prod");
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindMainTabs();
        window.__refreshAll();

        // Initialize agent filter
        updateAgentFilter("");

        // Reset pagination when filters change - with debounce
        const debouncedRenderNow = debounce(() => {
            window.PaginationState.now.page = 1;
            renderNow();
        }, 300);

        const fProjectEl = document.getElementById("f_project");
        if (fProjectEl) {
            fProjectEl.addEventListener("change", () => {
                updateAgentFilter(fProjectEl.value);
                debouncedRenderNow();
            });
        }

        ["f_agent", "f_prio"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("change", debouncedRenderNow);
        });
    });

})();
