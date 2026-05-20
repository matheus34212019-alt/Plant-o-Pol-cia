(function plantaoReadableLoginGuard() {
    if(window.__plantaoReadableLoginGuard) return;
    window.__plantaoReadableLoginGuard = true;

    const GUARD_FLAG = '__plantaoReadableLoginGuardWrapped';
    const EMPTY_DAY_TEXT = 'O cronograma encontrou um dia vazio no seu planejamento. Recarregue a página e tente entrar novamente.';
    const INCOMPLETE_DATA_TEXT = 'O site recebeu uma informação incompleta ao abrir sua conta. Recarregue a página e tente novamente.';

    function rawErrorText(value) {
        if(!value) return '';
        if(typeof value === 'string') return value;
        return [
            value.message,
            value.details,
            value.hint,
            value.code
        ].filter(Boolean).join(' ');
    }

    function friendlyError(value) {
        const raw = rawErrorText(value);
        const lower = raw.toLowerCase();
        if(!lower) return '';

        if(lower.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
        if(lower.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
        if(lower.includes('failed to fetch') || lower.includes('network')) return 'Falha de conexão com a nuvem. Confira sua internet e tente novamente.';
        if(lower.includes('rate limit')) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
        if(lower.includes('jwt') || lower.includes('expired')) return 'Sua sessão expirou. Entre novamente.';
        if(lower.includes('permission denied') || lower.includes('row-level security') || lower.includes('rls')) {
            return 'Permissão negada na nuvem. Verifique se sua conta está aprovada.';
        }
        if(lower.includes('plantao_user_access') || lower.includes('schema cache') || lower.includes('could not find the table')) {
            return 'A configuração de acesso na nuvem ainda não está pronta. Avise o administrador para verificar o Supabase.';
        }
        if(lower.includes('cannot read properties') && (lower.includes('reduce') || lower.includes('map') || lower.includes('foreach'))) {
            return EMPTY_DAY_TEXT;
        }
        if(lower.includes('cannot read properties') || lower.includes('undefined')) return INCOMPLETE_DATA_TEXT;

        return '';
    }

    function normalizeStatus(text) {
        const original = String(text || '').trim();
        const friendly = friendlyError(original);
        if(!friendly) return original;
        if(original.toLowerCase().includes('login')) return `Não foi possível concluir o login: ${friendly}`;
        if(original.toLowerCase().includes('entrar')) return `Não foi possível entrar: ${friendly}`;
        return friendly;
    }

    function getGlobalFunction(name) {
        try {
            const value = Function(`return typeof ${name} === "function" ? ${name} : null;`)();
            return value || null;
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

    function patchStatusMessage() {
        const original = getGlobalFunction('setCloudStatus');
        if(!original || original[GUARD_FLAG]) return Boolean(original);

        function readableSetCloudStatus(text) {
            return original.call(this, normalizeStatus(text));
        }

        readableSetCloudStatus[GUARD_FLAG] = true;
        readableSetCloudStatus.__plantaoOriginal = original;
        setGlobalFunction('setCloudStatus', readableSetCloudStatus);
        return true;
    }

    function patchSupabaseMessage() {
        const original = getGlobalFunction('mensagemErroSupabase');
        if(!original || original[GUARD_FLAG]) return Boolean(original);

        function readableMensagemErroSupabase(error) {
            return friendlyError(error) || original.apply(this, arguments);
        }

        readableMensagemErroSupabase[GUARD_FLAG] = true;
        readableMensagemErroSupabase.__plantaoOriginal = original;
        setGlobalFunction('mensagemErroSupabase', readableMensagemErroSupabase);
        return true;
    }

    function cleanVisibleLoginStatus() {
        const el = document.getElementById('cloud-login-status');
        if(!el) return;
        const normalized = normalizeStatus(el.textContent);
        if(normalized && normalized !== el.textContent) el.textContent = normalized;
    }

    function getDb() {
        try {
            return Function('return typeof db === "undefined" ? null : db;')();
        } catch(_) {
            return null;
        }
    }

    function getDateKey(date) {
        const safeDate = date instanceof Date ? new Date(date) : new Date(date || Date.now());
        if(Number.isNaN(safeDate.getTime())) return '';
        try {
            const keyFn = getGlobalFunction('dateKey');
            if(keyFn) return keyFn(safeDate);
        } catch(_) {}
        return safeDate.toISOString().slice(0, 10);
    }

    function ensureDayList(date) {
        const state = getDb();
        const key = getDateKey(date);
        if(!state || !key) return null;
        if(!state.metaFixa || typeof state.metaFixa !== 'object' || Array.isArray(state.metaFixa)) state.metaFixa = {};
        if(!Array.isArray(state.metaFixa[key])) state.metaFixa[key] = [];
        return { state, key, tasks: state.metaFixa[key] };
    }

    function isEmptyDayError(error) {
        const lower = rawErrorText(error).toLowerCase();
        return lower.includes('cannot read properties') && (
            lower.includes('reduce') ||
            lower.includes('map') ||
            lower.includes('foreach')
        );
    }

    function renderEmptyDayFallback(date) {
        const safeDate = date instanceof Date ? date : new Date(date || Date.now());
        const day = ensureDayList(safeDate);
        const state = day && day.state;
        const meta = document.getElementById('meta-status');
        const list = document.getElementById('lista-diaria');
        const title = document.getElementById('view-title');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        safeDate.setHours(0, 0, 0, 0);
        const dailyHours = state && state.h ? (parseFloat(state.h[safeDate.getDay()]) || 0) : 0;

        if(meta) meta.innerText = `0.0h / ${dailyHours}h meta`;
        if(title) title.innerText = safeDate.getTime() === today.getTime() ? 'Missão de Hoje' : 'Missão de Amanhã';
        if(list) {
            list.innerHTML = [
                '<div class="empty-state">',
                '<i class="fas fa-calendar-day"></i>',
                '<strong>Sem atividades para este dia</strong>',
                '<span>O cronograma vai preencher os próximos horários quando houver pendências.</span>',
                '</div>'
            ].join('');
        }

        const replan = document.querySelector('.replan-btn');
        if(replan) replan.style.display = 'none';
    }

    function patchDailyRenderer() {
        const original = getGlobalFunction('renderDiario');
        if(!original || original[GUARD_FLAG]) return Boolean(original);

        function guardedRenderDiario(date) {
            const safeDate = date || new Date();
            ensureDayList(safeDate);
            try {
                return original.apply(this, arguments.length ? arguments : [safeDate]);
            } catch(error) {
                if(!isEmptyDayError(error)) throw error;
                ensureDayList(safeDate);
                try {
                    return original.call(this, safeDate);
                } catch(secondError) {
                    if(!isEmptyDayError(secondError)) throw secondError;
                    renderEmptyDayFallback(safeDate);
                    cleanVisibleLoginStatus();
                    return undefined;
                }
            }
        }

        guardedRenderDiario[GUARD_FLAG] = true;
        guardedRenderDiario.__plantaoOriginal = original;
        setGlobalFunction('renderDiario', guardedRenderDiario);
        return true;
    }

    function install() {
        const statusReady = patchStatusMessage();
        const messageReady = patchSupabaseMessage();
        const renderReady = patchDailyRenderer();
        cleanVisibleLoginStatus();
        return statusReady && messageReady && renderReady;
    }

    document.addEventListener('DOMContentLoaded', install, true);
    window.addEventListener('load', install);

    let tries = 0;
    const timer = setInterval(() => {
        tries += 1;
        if(install() || tries > 160) clearInterval(timer);
    }, 75);
})();
