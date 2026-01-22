/* ================= PAGINATION CONTROLLER ================= */

window.PaginationState = {
    now: { page: 1, limit: 20 },
    leads: { page: 1, limit: 20 },
    calls: { page: 1, limit: 20 }
};

function buildPaginationHTML(state, totalPages, onPageChange) {
    if (totalPages <= 1) {
        return '';
    }

    let html = '<button class="prev-page" data-page="' + (state.page - 1) + '">← Précédent</button>';

    // Première page
    html += '<button data-page="1" class="' + (state.page === 1 ? 'active' : '') + '">1</button>';

    // Points de suspension si nécessaire
    if (state.page > 3) {
        html += '<span class="dots" style="padding: 0; border: none; background: none; cursor: default; color: #999;">...</span>';
    }

    // Pages autour de la page actuelle
    const start = Math.max(2, state.page - 1);
    const end = Math.min(totalPages - 1, state.page + 1);

    for (let i = start; i <= end; i++) {
        html += '<button data-page="' + i + '" class="' + (state.page === i ? 'active' : '') + '">' + i + '</button>';
    }

    // Points de suspension si nécessaire
    if (state.page < totalPages - 2) {
        html += '<span class="dots" style="padding: 0; border: none; background: none; cursor: default; color: #999;">...</span>';
    }

    // Dernière page
    if (totalPages > 1) {
        html += '<button data-page="' + totalPages + '" class="' + (state.page === totalPages ? 'active' : '') + '">' + totalPages + '</button>';
    }

    html += '<button class="next-page" data-page="' + (state.page + 1) + '">Suivant →</button>';
    
    // Info
    html += '<span class="info">Page ' + state.page + ' / ' + totalPages + '</span>';

    return html;
}

function setupPaginationButtons(containerId, state, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('button').forEach(btn => {
        const page = parseInt(btn.getAttribute('data-page'));
        if (!isNaN(page) && page > 0) {
            btn.disabled = (state.page === page);
            btn.addEventListener('click', () => {
                state.page = page;
                onPageChange();
            });
        }
    });
}
