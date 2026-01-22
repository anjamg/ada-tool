(function(){

    window.renderDashboard = async function(){
        const d = await api.dashboard({});

        const pct = d.reactivite_pct_under_45 ?? 0;
        const mean = d.reactivite_mean_minutes ?? "—";
        const med = d.reactivite_median_minutes ?? "—";

        document.getElementById("view-dashboard").innerHTML = `
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-title">Réactivité &lt; 45 min</div>
          <div class="kpi-value">${pct}%</div>
          <div class="kpi-sub">
            Mesurés: ${d.reactivite_measured_leads} /
            Scope: ${d.reactivite_in_scope_leads}
            • Moy: ${mean} • Méd: ${med}
          </div>
        </div>
        <div class="kpi">
          <div class="kpi-title">Combativité</div>
          <div class="kpi-value">${d.combativite_calls_per_lead}</div>
          <div class="kpi-sub">
            Appels: ${d.calls_total} • Leads: ${d.leads_total}
          </div>
        </div>
      </div>`;
    };

})();
