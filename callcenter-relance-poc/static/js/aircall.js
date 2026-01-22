function normalizePhoneFR(raw){
    let n = String(raw || "").replace(/\D/g, "");
    if (n.startsWith("0")) n = "33" + n.slice(1);
    if (n.startsWith("33") && n.length === 11) return n;
    return null;
}

function openAircall(){
    const input = prompt("Collez le numéro utilisé dans Aircall (06… ou +33…)");

    if (!input) return;

    const normalized = normalizePhoneFR(input);
    if (!normalized) {
        alert("Numéro invalide.\nFormat attendu : 337XXXXXXXX");
        return;
    }

    const phoneInput = document.getElementById("call_phone");
    phoneInput.textContent = normalized;

    // déclenche Aircall (extension intercepte tel:)
    window.location.href = `tel:${normalized}`;
}
