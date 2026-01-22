(function () {
    const modal = document.getElementById("relanceModal");
    const btnCancel = document.getElementById("btnRelanceCancel");
    const btnSave = document.getElementById("btnRelanceSave");

    const relanceDate = document.getElementById("relance_date");

    // Annuler → fermer
    btnCancel.addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    // Enregistrer → validation minimale
    btnSave.addEventListener("click", () => {
        if (!relanceDate.value) {
            alert("Veuillez renseigner la date de relance");
            return;
        }
        // La sauvegarde est déclenchée dans call-flow.js
        modal.classList.add("hidden");
    });
})();
