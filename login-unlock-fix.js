(function plantaoLoginUnlockFix() {
    if(window.__plantaoLoginUnlockFix) return;
    window.__plantaoLoginUnlockFix = true;

    const VERSION = 'v247-login-unlock';
    const OWNER_FIELD = '__plantaoOwner';
    const WRAPPED = '__plantaoLoginUnlockWrapped';

    function value(name, fallback = null) {
        try { return Function(`return typeof ${name} === "undefined" ? null : ${name};`)() ?? fallback; }
        catch(_) { return fallback; }
    }

    function fn(name) {
        const found = value(name);
        return typeof found === 'function' ? found : null;
    }

    function setFn(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch(_) {}
        try { window[name] = replacement; } catch(_) {}
    }

    function setFlag(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch(_) {}
    }

    function client() {
        return value('supabaseClient', null);
    }

    function target() {
        const cloudTarget = fn('alvoDadosNuvem');
        if(cloudTarget) {
            try {
                const found = cloudTarget();
                if(found?.user_id) return { userId: String(found.user_id), email: found.email || null, name: found.name || null };
            } catch(_) {}
        }
        const user = value('cloudUser', null);
        const userId = user?.id || user?.uid;
        return userId ? { userId: String(userId), email: user.email || null, name: user.name || null } : null;
    }

    function defaultData() {
        return {
            lista: [],
            ciclo: [],
            h: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 0: 4 },
            metaFixa: {}
        };
    }

    function clone(data) {
        return JSON.parse(JSON.stringify(data || defaultData()));
    }

    function stampOwner(data, currentTarget, reason) {
        if(!data || !currentTarget?.userId) return data;
        data[OWNER_FIELD] = {
            userId: String(currentTarget.userId),
            version: VERSION,
            reason,
            updatedAt: new Date().toISOString()
        };
        return data;
    }

    function log(type, detail = {}) {
        try {
            if(typeof window.__plantaoLogRuntimeEvent === 'function') {
                window.__plantaoLogRuntimeEvent(type, { ...detail, version: VERSION });
            }
        } catch(_) {}
    }

    async function readRemote(currentTarget) {
        const supabase = client();
        if(!supabase || !currentTarget?.userId) return { row: null, error: null };
        const result = await supabase
            .from('plantao_user_data')
            .select('data,email,updated_at,user_id')
            .eq('user_id', currentTarget.userId)
            .maybeSingle();
        return { row: result.data || null, error: result.error || null };
    }

    async function createEmptyRemote(currentTarget) {
        const supabase = client();
        const data = stampOwner(defaultData(), currentTarget, 'login-unlock-empty-row');
        const payload = {
            user_id: currentTarget.userId,
            email: currentTarget.email || null,
            data,
            updated_at: new Date().toISOString()
        };
        const result = await supabase.from('plantao_user_data').upsert(payload, { onConflict: 'user_id' });
        if(result?.error) throw result.error;
        return data;
    }

    function finalize(data, currentTarget, reason) {
        const next = stampOwner(clone(data || defaultData()), currentTarget, reason);
        try { Function('next', 'db = next;')(next); } catch(_) { return false; }
        setFlag('carregandoNuvem', true);
        try { fn('normalizarBanco')?.(); } catch(_) {}
        try { fn('aplicarPreferenciasLocais')?.(); } catch(_) {}
        stampOwner(value('db', next), currentTarget, `${reason}-normalized`);
        try { localStorage.setItem('prf_v120', JSON.stringify(value('db', next))); } catch(_) {}
        setFlag('dadosSupabaseCarregados', true);
        setFlag('carregandoNuvem', false);
        window.__plantaoCloudDataReady = true;
        document.body?.classList.remove('plantao-data-loading');
        document.documentElement.dataset.loginUnlock = VERSION;
        log('login-unlock-loaded', { userId: currentTarget.userId, reason });
        try { fn('init')?.(); } catch(_) {}
        return true;
    }

    function install() {
        const original = fn('carregarDadosSupabase');
        if(typeof original !== 'function' || original[WRAPPED]) return false;

        async function carregarDadosSupabaseComDesbloqueio() {
            const result = await original.apply(this, arguments);
            if(result !== false) return result;

            const currentTarget = target();
            if(!client() || !currentTarget?.userId) return result;

            try {
                const { row, error } = await readRemote(currentTarget);
                if(error) throw error;
                const data = row?.data || await createEmptyRemote(currentTarget);
                return finalize(data, currentTarget, row?.data ? 'login-unlock-remote-user-id' : 'login-unlock-empty-row');
            } catch(error) {
                log('login-unlock-error', { userId: currentTarget.userId, message: String(error?.message || error) });
                return result;
            }
        }

        carregarDadosSupabaseComDesbloqueio[WRAPPED] = true;
        carregarDadosSupabaseComDesbloqueio.__plantaoOriginal = original;
        setFn('carregarDadosSupabase', carregarDadosSupabaseComDesbloqueio);
        return true;
    }

    install();
    const timer = setInterval(() => {
        if(install()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 15000);
})();
