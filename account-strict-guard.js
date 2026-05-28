(function plantaoStrictAccountGuard() {
    if(window.__plantaoStrictAccountGuardRequested) return;
    window.__plantaoStrictAccountGuardRequested = true;

    const VERSION = 'v243-strict-account-supabase';
    const OWNER_FIELD = '__plantaoOwner';
    const WRAPPED = '__plantaoStrictAccountGuardWrapped';
    const QUARANTINE_PREFIX = 'plantao_quarantined_foreign_data_v1_';

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

    function clone(data) {
        return JSON.parse(JSON.stringify(data || {}));
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

    function state() {
        return value('db', null);
    }

    function client() {
        return value('supabaseClient', null);
    }

    function isEditingStudent() {
        const checker = fn('editandoAlunoComoAdmin');
        try { return checker ? Boolean(checker()) : false; } catch(_) { return false; }
    }

    function defaultData() {
        return {
            lista: [],
            ciclo: [],
            h: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 0: 4 },
            metaFixa: {}
        };
    }

    function setState(data) {
        try { Function('data', 'db = data;')(clone(data || defaultData())); } catch(_) { return false; }
        return true;
    }

    function ownerOf(data) {
        return String(data?.[OWNER_FIELD]?.userId || data?.ownerUserId || data?.owner_user_id || data?.__ownerUserId || '');
    }

    function ownerMismatch(data, currentTarget) {
        const owner = ownerOf(data);
        return Boolean(owner && currentTarget?.userId && owner !== String(currentTarget.userId));
    }

    function score(data) {
        const subjects = Array.isArray(data?.lista) ? data.lista.length : 0;
        const tasks = Object.values(data?.metaFixa || {}).flat().filter(Boolean);
        const launches = Array.isArray(data?.lancamentos) ? data.lancamentos.length : 0;
        return subjects * 4 + tasks.length * 2 + tasks.filter(item => item?.c).length * 3 + launches * 3;
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

    function storeLocal(data) {
        try { localStorage.setItem('prf_v120', JSON.stringify(data)); } catch(_) {}
    }

    function log(type, detail = {}) {
        try {
            if(typeof window.__plantaoLogRuntimeEvent === 'function') {
                window.__plantaoLogRuntimeEvent(type, { ...detail, version: VERSION });
            }
        } catch(_) {}
    }

    function status(kind, text) {
        const update = fn('setSalvamentoStatus');
        if(update) {
            try { update(kind, text); } catch(_) {}
        }
    }

    function setFlag(name, valueToSet) {
        try { Function('valueToSet', `${name} = valueToSet;`)(valueToSet); } catch(_) {}
    }

    function preserveQuarantine(data, currentTarget, reason) {
        if(!data || score(data) <= 0) return;
        try {
            const suffix = `${currentTarget?.userId || 'unknown'}_${Date.now()}`.replace(/[^a-z0-9_-]/gi, '-');
            localStorage.setItem(QUARANTINE_PREFIX + suffix, JSON.stringify({
                reason,
                expectedUserId: currentTarget?.userId || null,
                foundOwner: ownerOf(data) || null,
                createdAt: new Date().toISOString(),
                data: clone(data)
            }));
            log('foreign-data-quarantined', { reason, expectedUserId: currentTarget?.userId || null, foundOwner: ownerOf(data) || null });
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

    function finalizeLoadedData(data, currentTarget, reason) {
        const next = stampOwner(clone(data || defaultData()), currentTarget, reason);
        setState(next);
        setFlag('carregandoNuvem', true);
        try { fn('normalizarBanco')?.(); } catch(_) {}
        try { fn('aplicarPreferenciasLocais')?.(); } catch(_) {}
        stampOwner(state(), currentTarget, `${reason}-normalized`);
        storeLocal(state());
        setFlag('dadosSupabaseCarregados', true);
        setFlag('carregandoNuvem', false);
        window.__plantaoCloudDataReady = true;
        document.body?.classList.remove('plantao-data-loading');
        document.documentElement.dataset.strictAccountGuard = VERSION;
        log('strict-account-load', { userId: currentTarget.userId, reason, score: score(state()) });
        return true;
    }

    function blockLoad(currentTarget, reason, data = null) {
        preserveQuarantine(data, currentTarget, reason);
        setFlag('dadosSupabaseCarregados', false);
        setFlag('carregandoNuvem', false);
        window.__plantaoCloudDataReady = false;
        log('strict-account-load-blocked', { userId: currentTarget?.userId || null, reason });
        return false;
    }

    async function createEmptyRemote(currentTarget) {
        try {
            const supabase = client();
            if(!supabase || !currentTarget?.userId || isEditingStudent()) return;
            const payload = {
                user_id: currentTarget.userId,
                email: currentTarget.email || null,
                data: state(),
                updated_at: new Date().toISOString()
            };
            await supabase.from('plantao_user_data').upsert(payload, { onConflict: 'user_id' });
        } catch(_) {}
    }

    function installLoadGuard() {
        const original = fn('carregarDadosSupabase');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        async function carregarDadosSupabaseEstrito() {
            const currentTarget = target();
            const supabase = client();
            if(!supabase || !currentTarget?.userId) return original.apply(this, arguments);

            setFlag('carregandoNuvem', true);
            try {
                const { row, error } = await readRemote(currentTarget);
                if(error) throw error;
                if(row?.data) {
                    if(ownerMismatch(row.data, currentTarget)) return blockLoad(currentTarget, 'remote-owner-mismatch', row.data);
                    return finalizeLoadedData(row.data, currentTarget, 'strict-remote-user-id');
                }

                if(isEditingStudent()) return blockLoad(currentTarget, 'student-without-remote-row');
                const current = state();
                if(score(current) > 0 && !ownerOf(current)) preserveQuarantine(current, currentTarget, 'remote-empty-ownerless-local');
                if(ownerMismatch(current, currentTarget)) preserveQuarantine(current, currentTarget, 'remote-empty-owner-mismatch-local');
                finalizeLoadedData(defaultData(), currentTarget, 'strict-empty-remote');
                await createEmptyRemote(currentTarget);
                return true;
            } catch(error) {
                status('error', 'Erro ao carregar dados da conta');
                log('strict-account-load-error', { userId: currentTarget.userId, message: String(error?.message || error) });
                return blockLoad(currentTarget, 'remote-read-error');
            } finally {
                setFlag('carregandoNuvem', false);
            }
        }
        carregarDadosSupabaseEstrito[WRAPPED] = true;
        carregarDadosSupabaseEstrito.__plantaoOriginal = original;
        setFn('carregarDadosSupabase', carregarDadosSupabaseEstrito);
        return true;
    }

    function installSaveGuard() {
        const original = fn('salvarDadosSupabase');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        async function salvarDadosSupabaseEstrito() {
            const currentTarget = target();
            const data = state();
            if(!client() || !currentTarget?.userId || !data) return original.apply(this, arguments);
            if(ownerMismatch(data, currentTarget)) {
                preserveQuarantine(data, currentTarget, 'save-owner-mismatch');
                status('error', 'Salvamento bloqueado por seguranca');
                return;
            }
            if(!ownerOf(data) && score(data) > 0) {
                preserveQuarantine(data, currentTarget, 'save-ownerless-data-blocked');
                status('error', 'Salvamento bloqueado por seguranca');
                return;
            }
            stampOwner(data, currentTarget, 'strict-save');
            storeLocal(data);
            return original.apply(this, arguments);
        }
        salvarDadosSupabaseEstrito[WRAPPED] = true;
        salvarDadosSupabaseEstrito.__plantaoOriginal = original;
        setFn('salvarDadosSupabase', salvarDadosSupabaseEstrito);
        return true;
    }

    function install() {
        const loadReady = installLoadGuard();
        const saveReady = installSaveGuard();
        return loadReady && saveReady;
    }

    install();
    const timer = setInterval(install, 250);
    setTimeout(() => clearInterval(timer), 15000);
})();
