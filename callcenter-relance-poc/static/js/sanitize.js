/* ================= XSS PROTECTION & SANITIZATION ================= */

function escapeHtml(text) {
    if (!text) return "—";
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function sanitize(text, maxLength = 100) {
    if (!text) return "—";
    let sanitized = escapeHtml(text);
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + "...";
    }
    return sanitized;
}
