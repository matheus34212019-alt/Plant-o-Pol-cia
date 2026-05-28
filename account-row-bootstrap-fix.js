(function plantaoAccountRowBootstrapFix() {
    if(window.__plantaoAccountRowBootstrapFix) return;
    window.__plantaoAccountRowBootstrapFix = true;

    const VERSION = 'v245-own-row-bootstrap';
    const OWNER_FIELD = '__plantaoOwner';
    const WRAPPED = '__plantaoOwnRowBootstrapWrapped';

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

    function client() {
        return value('supabaseClient', null);
    }

    function defaultData() {
        return {
            lista: [],
            ciclo: [],
            h: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 0: 4 },
            metaFixa: {}
        };
    }

    function ownerOf(data) {
        return String(data?.[OWNER_FIELD]?.userId || data?.ownerUserId || data?.owner_user_id || data?.__ownerUserId || '');
    }

    function ownerMismatch(data, currentTarget) {
        const owner = ownerOf(data);
        return Boolean(owner && currentTarget?.userId && owner !== String(currentTarget.userId));
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

    async function createEmptyRemote(currentTarget, reason) {
        const supabase = client();
        if(!supabase || !currentTarget?.userId) return null;
        const data = stampOwner(defaultData(), currentTarget, reason);
        const payload = {
            user_id: currentTarget.userId,
            email: currentTarget.email || null,
            data,
            updated_at: new Date().toISOString()
        };
        const result = await supabase.from('plantao_user_data').upsert(payload, { onConflict: 'user_id' });
        if(result?.error) throw result.error;
        log('own-row-created', { userId: currentTarget.userId, reason });
        return data;
    }

    async function ensureOwnRemoteRow(currentTarget, reason) {
        const { row, error } = await readRemote(currentTarget);
        if(error) throw error;
        if(row?.data) {
            if(ownerMismatch(row.data, currentTarget)) {
                log('own-row-owner-mismatch', { userId: currentTarget.userId, foundOwner: ownerOf(row.data), reason });
                return null;
            }
            return row.data;
        }
        return createEmptyRemote(currentTarget, reason);
    }

    function applyLoadedData(data, currentTarget, reason) {
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
        try { fn('init')?.(); } catch(_) {}
        return true;
    }

    function isEditingStudent() {
        const checker = fn('editandoAlunoComoAdmin');
        try { return checker ? Boolean(checker()) : false; } catch(_) { return false; }
    }

    function installLoadWrapper() {
        const original = fn('carregarDadosSupabase');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        async function carregarDadosSupabaseComLinhaPropria() {
            const result = await original.apply(this, arguments);
            if(result !== false || !isEditingStudent()) return result;
            const currentTarget = target();
            if(!currentTarget?.userId) return result;
            try {
                const data = await ensureOwnRemoteRow(currentTarget, 'admin-open-empty-student-row');
                if(!data) return result;
                return applyLoadedData(data, currentTarget, 'admin-open-empty-student-row');
            } catch(error) {
                log('own-row-load-wrapper-error', { userId: currentTarget.userId, message: String(error?.message || error) });
                return result;
            }
        }
        carregarDadosSupabaseComLinhaPropria[WRAPPED] = true;
        carregarDadosSupabaseComLinhaPropria.__plantaoOriginal = original;
        setFn('carregarDadosSupabase', carregarDadosSupabaseComLinhaPropria);
        return true;
    }

    function installApprovalWrapper() {
        const original = fn('alterarAcessoAluno');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        async function alterarAcessoAlunoComLinhaPropria(email, statusValue) {
            const result = await original.apply(this, arguments);
            if(String(statusValue || '').toLowerCase() !== 'approved') return result;
            const cleanEmail = decodeURIComponent(String(email || '')).toLowerCase();
            const list = value('adminAccessList', []);
            const aluno = Array.isArray(list)
                ? list.find(item => String(item.email || '').toLowerCase() === cleanEmail)
                : null;
            if(!aluno?.user_id) {
                log('approval-without-user-id', { email: cleanEmail });
                return result;
            }
            const nameFn = fn('nomePublicoAluno');
            const currentTarget = {
                userId: String(aluno.user_id),
                email: cleanEmail,
                name: nameFn ? nameFn(aluno) : (aluno.name || cleanEmail || 'Aluno')
            };
            try {
                await ensureOwnRemoteRow(currentTarget, 'approval-empty-student-row');
            } catch(error) {
                log('approval-empty-student-row-error', { userId: currentTarget.userId, message: String(error?.message || error) });
            }
            return result;
        }
        alterarAcessoAlunoComLinhaPropria[WRAPPED] = true;
        alterarAcessoAlunoComLinhaPropria.__plantaoOriginal = original;
        setFn('alterarAcessoAluno', alterarAcessoAlunoComLinhaPropria);
        return true;
    }

    function install() {
        installLoadWrapper();
        installApprovalWrapper();
        document.documentElement.dataset.ownRowBootstrap = VERSION;
    }

    install();
    const timer = setInterval(install, 250);
    setTimeout(() => clearInterval(timer), 15000);
})();
