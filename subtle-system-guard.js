(function plantaoSubtleSystemGuard() {
    if(window.__plantaoSubtleSystemGuard) return;
    window.__plantaoSubtleSystemGuard = true;

    const WRAPPED = '__plantaoSubtleSystemWrapped';
    const INTERNAL_TABS = new Set(['seguranca', 'diagnostico', 'backup']);
    const FORCE_QUIET_RE = /salvamento bloqueado|dados sincronizados|nuvem ativada|backup|vers[aã]o restaurada|altera[cç][aã]o desfeita|lan[cç]amentos recuperados|plant[aã]o replanejado|ciclo ativado|hor[aá]rios salvos|horas salvas|edital importado|mat[eé]ria salva|fluxo atualizado|assunto atualizado|data do edital salva|nome atualizado/i;
    const ROUTINE_STATUS_RE = /preparando|verificando|carregando|finalizando|conectado como|supabase conectado|entrando com e-mail|salvando|sincron/i;
    const IMPORTANT_RE = /falha|erro|senha|e-mail|email|login|internet|conex[aã]o|permiss[aã]o|aprov|cadastro|incorret|expirou|negad|recusad|indispon/i;

    function textOf(value) {
        return String(value || '').trim();
    }

    function logInternal(label, data) {
        try {
            const key = 'plantao_internal_events_v1';
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            list.push({ at: new Date().toISOString(), label, data });
            localStorage.setItem(key, JSON.stringify(list.slice(-80)));
        } catch(_) {}
    }

    function getGlobalFunction(name) {
        try {
            return Function(`return typeof ${name} === "function" ? ${name} : null;`)();
        } catch(_) {
            return typeof window[name] === 'function' ? window[name] : null;
        }
    }

    function setGlobalFunction(name, fn) {
        try {
            Function('fn', `${name} = fn;`)(fn);
        } catch(_) {}
        try {
            window[name] = fn;
        } catch(_) {}
    }

    function installStyle() {
        if(document.getElementById('plantao-subtle-system-style')) return;
        const style = document.createElement('style');
        style.id = 'plantao-subtle-system-style';
        style.textContent = `
            #seguranca,
            #diagnostico,
            #profile-safety-shortcut,
            [data-safety-link],
            [data-internal-system-ui],
            [onclick*="showTab('seguranca')"],
            [onclick*="showTab('diagnostico')"],
            [onclick*="showTab('backup')"],
            [onclick*='showTab("seguranca")'],
            [onclick*='showTab("diagnostico")'],
            [onclick*='showTab("backup")'] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
            #save-status-pill {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function containsInternalText(el) {
        const text = textOf(el?.textContent).toLowerCase();
        return (
            text.includes('segurança e backup') ||
            text.includes('seguranca e backup') ||
            text.includes('segurança dos dados') ||
            text.includes('seguranca dos dados') ||
            text.includes('diagnóstico do plano') ||
            text.includes('diagnostico do plano')
        );
    }

    function markHidden(el) {
        if(!el) return;
        el.setAttribute('data-internal-system-ui', 'true');
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
    }

    function cleanupInternalUi() {
        document.querySelectorAll('#seguranca, #diagnostico, #profile-safety-shortcut, [data-safety-link]').forEach(markHidden);

        document.querySelectorAll('[onclick]').forEach(el => {
            const action = String(el.getAttribute('onclick') || '');
            if(action.includes("showTab('seguranca')") || action.includes('showTab("seguranca")') ||
                action.includes("showTab('diagnostico')") || action.includes('showTab("diagnostico")') ||
                action.includes("showTab('backup')") || action.includes('showTab("backup")')) {
                const card = el.closest('.profile-actions-card, .stat-card');
                markHidden(card || el);
            }
        });

        document.querySelectorAll('.profile-actions-card, .stat-card, .page').forEach(el => {
            if(containsInternalText(el)) markHidden(el);
        });

        const active = document.querySelector('.page.active');
        if(active && INTERNAL_TABS.has(active.id)) {
            active.classList.remove('active');
            const fallback = document.getElementById('diaria') || document.querySelector('.page');
            if(fallback) fallback.classList.add('active');
        }

        const pill = document.getElementById('save-status-pill');
        if(pill) markHidden(pill);
    }

    function shouldQuietToast(title, body) {
        const text = `${textOf(title)} ${textOf(body)}`;
        if(FORCE_QUIET_RE.test(text)) return true;
        if(IMPORTANT_RE.test(text)) return false;
        return /sincron|salv|backup|restaur|diagn[oó]st|seguran[cç]a|nuvem|hist[oó]rico|vers[aã]o/i.test(text);
    }

    function patchToast() {
        const original = getGlobalFunction('showToast');
        if(!original || original[WRAPPED]) return Boolean(original);

        function subtleToast(title, body) {
            if(shouldQuietToast(title, body)) {
                logInternal('toast-silenciado', { title: textOf(title), body: textOf(body) });
                return undefined;
            }
            return original.apply(this, arguments);
        }

        subtleToast[WRAPPED] = true;
        subtleToast.__plantaoOriginal = original;
        setGlobalFunction('showToast', subtleToast);
        return true;
    }

    function patchCloudStatus() {
        const original = getGlobalFunction('setCloudStatus');
        if(!original || original[WRAPPED]) return Boolean(original);
        let loginProgressShown = false;

        function subtleCloudStatus(message) {
            const text = textOf(message);
            if(ROUTINE_STATUS_RE.test(text) && !IMPORTANT_RE.test(text)) {
                logInternal('status-silenciado', { message: text });
                if(!loginProgressShown) {
                    loginProgressShown = true;
                    return original.call(this, 'Entrando...');
                }
                return undefined;
            }
            return original.apply(this, arguments);
        }

        subtleCloudStatus[WRAPPED] = true;
        subtleCloudStatus.__plantaoOriginal = original;
        setGlobalFunction('setCloudStatus', subtleCloudStatus);
        return true;
    }

    function patchShowTab() {
        const original = getGlobalFunction('showTab');
        if(!original || original[WRAPPED]) return Boolean(original);

        function subtleShowTab(id, el) {
            if(INTERNAL_TABS.has(String(id || ''))) {
                cleanupInternalUi();
                logInternal('aba-interna-bloqueada', { id });
                const fallbackEl = document.querySelector(".nav-item[onclick*='diaria']");
                return original.call(this, 'diaria', fallbackEl || el);
            }
            const result = original.apply(this, arguments);
            cleanupInternalUi();
            return result;
        }

        subtleShowTab[WRAPPED] = true;
        subtleShowTab.__plantaoOriginal = original;
        setGlobalFunction('showTab', subtleShowTab);
        return true;
    }

    function patchProfileRender() {
        const original = getGlobalFunction('renderPerfil');
        if(!original || original[WRAPPED]) return Boolean(original);

        function subtleRenderPerfil() {
            const result = original.apply(this, arguments);
            cleanupInternalUi();
            return result;
        }

        subtleRenderPerfil[WRAPPED] = true;
        subtleRenderPerfil.__plantaoOriginal = original;
        setGlobalFunction('renderPerfil', subtleRenderPerfil);
        return true;
    }

    function patchInternalRenderers() {
        ['renderSegurancaDados', 'renderDiagnosticoPlano'].forEach(name => {
            const current = getGlobalFunction(name);
            if(current && current[WRAPPED]) return;
            const noop = function subtleInternalRenderer() {
                cleanupInternalUi();
                logInternal('render-interno-silenciado', { name });
                return undefined;
            };
            noop[WRAPPED] = true;
            noop.__plantaoOriginal = current || null;
            setGlobalFunction(name, noop);
        });
        return true;
    }

    function install() {
        installStyle();
        patchToast();
        patchCloudStatus();
        patchShowTab();
        patchProfileRender();
        patchInternalRenderers();
        cleanupInternalUi();
        return true;
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, true);
    } else {
        install();
    }

    const observer = new MutationObserver(() => cleanupInternalUi());
    try {
        observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch(_) {}

    let ticks = 0;
    const timer = setInterval(() => {
        ticks += 1;
        install();
        if(ticks > 160) clearInterval(timer);
    }, 250);
})();
