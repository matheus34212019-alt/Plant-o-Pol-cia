(function plantaoOwnAccountRecovery() {
    if(window.__plantaoOwnAccountRecovery) return;
    window.__plantaoOwnAccountRecovery = true;

    const VERSION = 'v232-own-account-session-restore';
    const OWNER_FIELD = '__plantaoOwner';
    const WRAPPED = '__plantaoOwnAccountRecoveryWrapped';

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

    function state() {
        return value('db', null);
    }

    function setState(data) {
        try { Function('data', 'db = data;')(clone(data)); } catch(_) { return false; }
        try { localStorage.setItem('prf_v120', JSON.stringify(state())); } catch(_) {}
        return true;
    }

    function target() {
        const cloudTarget = fn('alvoDadosNuvem');
        if(cloudTarget) {
            const found = cloudTarget();
            if(found?.user_id) return { userId: String(found.user_id), email: String(found.email || '').toLowerCase() };
        }
        const user = value('cloudUser', null);
        return user?.id ? { userId: String(user.id), email: String(user.email || '').toLowerCase() } : null;
    }

    function authenticatedMainEmail() {
        const user = value('cloudUser', null);
        return String(user?.email || '').trim().toLowerCase();
    }

    function isEditingStudent() {
        const checker = fn('editandoAlunoComoAdmin');
        try { return checker ? Boolean(checker()) : false; } catch(_) { return false; }
    }

    function ownerOf(data) {
        return data?.[OWNER_FIELD]?.userId || data?.ownerUserId || data?.owner_user_id || data?.__ownerUserId || '';
    }

    function belongsToTarget(data, currentTarget, permitUnstamped) {
        const owner = String(ownerOf(data) || '');
        if(owner) return owner === currentTarget.userId || owner.toLowerCase() === currentTarget.email;
        return Boolean(permitUnstamped);
    }

    function score(data) {
        const subjects = Array.isArray(data?.lista) ? data.lista.length : 0;
        const tasks = Object.values(data?.metaFixa || {}).flat().filter(Boolean);
        const launches = Array.isArray(data?.lancamentos) ? data.lancamentos.length : 0;
        return subjects * 4 + tasks.length * 2 + tasks.filter(item => item?.c).length * 3 + launches * 3;
    }

    function needsRecovery(data) {
        return score(data) === 0;
    }

    async function bestOwnBackup(client, currentTarget) {
        try {
            const result = await client
                .from('plantao_user_backups')
                .select('data,created_at')
                .eq('user_id', currentTarget.userId)
                .order('created_at', { ascending: false })
                .limit(30);
            if(result.error) return null;
            return (result.data || [])
                .map(row => row?.data)
                .filter(data => data && belongsToTarget(data, currentTarget, true) && score(data) > 0)
                .sort((a, b) => score(b) - score(a))[0] || null;
        } catch(_) {
            return null;
        }
    }

    async function bestLegacyMainRecord(client, currentTarget) {
        const ownEmail = authenticatedMainEmail();
        if(isEditingStudent() || !ownEmail || ownEmail !== currentTarget.email) return null;
        try {
            const result = await client
                .from('plantao_user_data')
                .select('data,updated_at')
                .eq('email', ownEmail)
                .order('updated_at', { ascending: false })
                .limit(10);
            if(result.error) return null;
            return (result.data || [])
                .map(row => row?.data)
                .filter(data => data && belongsToTarget(data, currentTarget, true) && score(data) > 0)
                .sort((a, b) => score(b) - score(a))[0] || null;
        } catch(_) {
            return null;
        }
    }

    async function recoverOwnData() {
        const client = value('supabaseClient', null);
        const currentTarget = target();
        if(!client || !currentTarget?.userId || value('dadosSupabaseCarregados', false) === false || !needsRecovery(state())) return false;
        const fromBackup = await bestOwnBackup(client, currentTarget);
        const restored = fromBackup || await bestLegacyMainRecord(client, currentTarget);
        if(!restored || !setState(restored)) return false;
        try { Function('dadosSupabaseCarregados = true;')(); } catch(_) {}
        fn('normalizarBanco')?.();
        try { localStorage.setItem('prf_v120', JSON.stringify(state())); } catch(_) {}
        fn('init')?.();
        const saveCloud = fn('salvarDadosSupabase');
        if(saveCloud) await saveCloud(true);
        document.documentElement.dataset.accountRecovery = VERSION;
        return true;
    }

    function install() {
        const original = fn('carregarDadosSupabase');
        if(!original || original[WRAPPED]) return false;
        async function loadWithOwnAccountRecovery() {
            const result = await original.apply(this, arguments);
            await recoverOwnData();
            return result;
        }
        loadWithOwnAccountRecovery[WRAPPED] = true;
        setFn('carregarDadosSupabase', loadWithOwnAccountRecovery);
        return true;
    }

    function retryLoadedSessionRecovery() {
        [400, 1200, 3000, 7000].forEach(delay => {
            setTimeout(() => recoverOwnData(), delay);
        });
    }

    if(install()) {
        retryLoadedSessionRecovery();
    } else {
        const timer = setInterval(() => {
            if(install()) {
                clearInterval(timer);
                retryLoadedSessionRecovery();
            }
        }, 120);
        setTimeout(() => clearInterval(timer), 12000);
    }
})();
