(function plantaoQuietModeFix() {
    if(window.__plantaoQuietModeFixInstalled) return;
    window.__plantaoQuietModeFixInstalled = true;
    window.__plantaoQuietMode = true;

    const QUIET_CONFIRM_MARK = 'Um ponto de restauração será criado antes da alteração.';
    const QUIET_TITLES = [
        'Dados sincronizados',
        'Nuvem ativada',
        'Plantão replanejado',
        'Ciclo ativado',
        'Horários salvos',
        'Edital importado',
        'Backup criado',
        'Backup do aluno criado',
        'Backup exportado',
        'Backup restaurado',
        'Versão restaurada',
        'Alteração desfeita'
    ];
    const IMPORTANT_RE = /falha|erro|indispon|bloquead|restrit|inv[aá]lid|aten[cç][aã]o|n[aã]o confirmado|sem backup|sem dados|sem planejamento/i;

    function installStyle() {
        if(document.getElementById('plantao-quiet-mode-style')) return;
        const style = document.createElement('style');
        style.id = 'plantao-quiet-mode-style';
        style.textContent = `
            #save-status-pill {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function suppressToast(title, text) {
        const t = String(title || '');
        const body = String(text || '');
        if(IMPORTANT_RE.test(t) || IMPORTANT_RE.test(body)) return false;
        return QUIET_TITLES.some(item => t.toLowerCase() === item.toLowerCase());
    }

    function wrapConfirm() {
        if(window.confirm?.__plantaoQuietModeWrapped) return;
        const original = window.confirm.bind(window);
        window.confirm = function quietConfirm(message) {
            const text = String(message || '');
            if(text.includes(QUIET_CONFIRM_MARK)) {
                try { console.info('[PLANTAO] Confirmação interna aplicada em modo silencioso.'); } catch(e) {}
                return true;
            }
            return original(message);
        };
        window.confirm.__plantaoQuietModeWrapped = true;
    }

    function wrapToast() {
        if(typeof window.showToast !== 'function' || window.showToast.__plantaoQuietModeWrapped) return false;
        const original = window.showToast;
        window.showToast = function quietToast(title, text) {
            if(suppressToast(title, text)) {
                try { console.info('[PLANTAO] Aviso interno silenciado:', title, text || ''); } catch(e) {}
                return;
            }
            return original.apply(this, arguments);
        };
        window.showToast.__plantaoQuietModeWrapped = true;
        return true;
    }

    function hideExistingPill() {
        const pill = document.getElementById('save-status-pill');
        if(pill) {
            pill.style.display = 'none';
            pill.setAttribute('aria-hidden', 'true');
        }
    }

    function install() {
        installStyle();
        wrapConfirm();
        wrapToast();
        hideExistingPill();
        return typeof window.showToast === 'function';
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }

    const timer = setInterval(() => {
        if(install()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 10000);
})();