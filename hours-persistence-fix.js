(function plantaoHoursPersistenceFix() {
    if(window.__plantaoHoursPersistenceFix) return;
    window.__plantaoHoursPersistenceFix = true;

    const VERSION = 'v224-safe-hours-save';
    const WRAPPED = '__plantaoHoursPersistenceWrapped';

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function setFn(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function getDb() {
        try { return Function('return typeof db === "undefined" ? null : db;')(); }
        catch(_) { return window.db || null; }
    }

    function number(value) {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
    }

    function captureInputs() {
        const hours = {};
        for(let i = 0; i < 7; i += 1) {
            hours[i] = number(document.getElementById(`h-in-${i}`)?.value);
        }
        return hours;
    }

    function sameHours(a, b) {
        for(let i = 0; i < 7; i += 1) {
            if(number(a?.[i]) !== number(b?.[i])) return false;
        }
        return true;
    }

    function patchSaveH() {
        const original = fn('saveH');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function safeSaveH() {
            const selected = captureInputs();
            const data = getDb();
            if(data) {
                data.horasDiariasAtualizadasEm = new Date().toISOString();
                data.horasDiariasOrigem = 'configuracao-do-aluno';
            }
            const result = original.apply(this, arguments);
            if(data && !sameHours(data.h, selected)) {
                data.h = selected;
                const save = fn('save');
                if(save) save();
            }
            return result;
        }
        safeSaveH[WRAPPED] = true;
        safeSaveH.__plantaoOriginal = original;
        setFn('saveH', safeSaveH);
        return true;
    }

    function install() {
        patchSaveH();
        document.documentElement.dataset.hoursPersistence = VERSION;
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
    const retry = setInterval(install, 250);
    setTimeout(() => clearInterval(retry), 10000);
})();

(function plantaoLaunchDedupeLoader() {
    if(window.__plantaoLaunchDedupeLoader) return;
    window.__plantaoLaunchDedupeLoader = true;
    if(window.__plantaoLaunchDedupeFix) return;
    const script = document.createElement('script');
    script.src = 'launch-dedupe-fix.js?v=242-launch-dedupe';
    script.defer = true;
    document.head.appendChild(script);
})();

(function plantaoOAuthSessionReturnFix() {
    if(window.__plantaoOAuthSessionReturnFix) return;
    window.__plantaoOAuthSessionReturnFix = true;

    const WRAPPED = '__plantaoOAuthSessionReturnWrapped';

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function value(name) {
        try { return Function(`return typeof ${name} === "undefined" ? null : ${name};`)(); }
        catch(_) { return window[name] || null; }
    }

    function setFn(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch(_) {}
        try { window[name] = replacement; } catch(_) {}
    }

    function rememberSession(result) {
        const session = result?.data?.session || result?.session || null;
        if(session?.user) {
            window.__plantaoOAuthReturnedSession = session;
            try { fn('setCloudStatus')?.('Login confirmado. Carregando seus dados...'); } catch(_) {}
        }
        return result;
    }

    function wrapClient(client) {
        const auth = client?.auth;
        if(!auth?.exchangeCodeForSession || auth.exchangeCodeForSession[WRAPPED]) return client;
        const originalExchange = auth.exchangeCodeForSession.bind(auth);
        auth.exchangeCodeForSession = async function exchangeCodeForSessionComSessaoGuardada() {
            return rememberSession(await originalExchange.apply(this, arguments));
        };
        auth.exchangeCodeForSession[WRAPPED] = true;
        return client;
    }

    function patchClientFactory() {
        const original = fn('criarClienteSupabase');
        if(!original || original[WRAPPED]) return false;
        function criarClienteSupabaseComRetornoOAuth() {
            return wrapClient(original.apply(this, arguments));
        }
        criarClienteSupabaseComRetornoOAuth[WRAPPED] = true;
        criarClienteSupabaseComRetornoOAuth.__plantaoOriginal = original;
        setFn('criarClienteSupabase', criarClienteSupabaseComRetornoOAuth);
        const activeClient = value('supabaseClient');
        if(activeClient) wrapClient(activeClient);
        return true;
    }

    function patchSessionWaiter() {
        const original = fn('esperarSessaoSupabase');
        if(!original || original[WRAPPED]) return false;
        async function esperarSessaoSupabaseComRetornoOAuth() {
            const returned = window.__plantaoOAuthReturnedSession;
            if(returned?.user) return returned;
            const session = await original.apply(this, arguments);
            return session || window.__plantaoOAuthReturnedSession || null;
        }
        esperarSessaoSupabaseComRetornoOAuth[WRAPPED] = true;
        esperarSessaoSupabaseComRetornoOAuth.__plantaoOriginal = original;
        setFn('esperarSessaoSupabase', esperarSessaoSupabaseComRetornoOAuth);
        return true;
    }

    function install() {
        return patchClientFactory() && patchSessionWaiter();
    }

    install();
    const timer = setInterval(() => {
        if(install()) clearInterval(timer);
    }, 50);
    setTimeout(() => clearInterval(timer), 6000);
})();

(function plantaoAccountSafetyOrderedLoader() {
    if(window.__plantaoAccountSafetyOrderedLoader) return;
    window.__plantaoAccountSafetyOrderedLoader = true;

    const queue = [
        {
            src: 'account-strict-guard.js?v=247-login-unlock',
            loaded: () => window.__plantaoStrictAccountGuard
        },
        {
            src: 'account-row-bootstrap-fix.js?v=247-login-unlock-bootstrap',
            loaded: () => window.__plantaoAccountRowBootstrapFix
        },
        {
            src: 'login-unlock-fix.js?v=247-login-unlock',
            loaded: () => window.__plantaoLoginUnlockFix
        }
    ];

    function loadNext(index) {
        const item = queue[index];
        if(!item) return;
        if(item.loaded()) {
            loadNext(index + 1);
            return;
        }

        const existing = Array.from(document.scripts || [])
            .find(script => (script.src || '').includes(item.src.split('?')[0]));
        if(existing) {
            existing.addEventListener('load', () => loadNext(index + 1), { once: true });
            setTimeout(() => loadNext(index + 1), 900);
            return;
        }

        const script = document.createElement('script');
        script.src = item.src;
        script.async = false;
        script.onload = () => loadNext(index + 1);
        script.onerror = () => loadNext(index + 1);
        document.head.appendChild(script);
    }

    loadNext(0);
})();
