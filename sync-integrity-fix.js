(function plantaoSyncIntegrityFix() {
    if(window.__plantaoSyncIntegrityFixRequested) return;
    window.__plantaoSyncIntegrityFixRequested = true;

    const VERSION = 'v225-revision-safe-save';
    const BACKUP_TABLE = 'plantao_user_backups';
    const REVISION_PREFIX = 'plantao_cloud_revision_v2_';
    const CONFLICT_PREFIX = 'plantao_conflict_copy_v1_';
    const OWNER_FIELD = '__plantaoOwner';

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
            const found = cloudTarget();
            if(found?.user_id) {
                return { userId: String(found.user_id), email: found.email || null };
            }
        }
        const user = value('cloudUser');
        const userId = user?.id || user?.uid;
        return userId ? { userId: String(userId), email: user.email || null } : null;
    }

    function dbRef() {
        return value('db');
    }

    function client() {
        return value('supabaseClient');
    }

    function storageKey(userId) {
        return REVISION_PREFIX + String(userId || '').replace(/[^a-z0-9_-]/gi, '-');
    }

    function knownRevision(userId) {
        try { return sessionStorage.getItem(storageKey(userId)) || ''; } catch(_) { return ''; }
    }

    function rememberRevision(userId, revision) {
        if(!userId || !revision) return;
        try { sessionStorage.setItem(storageKey(userId), String(revision)); } catch(_) {}
    }

    function sameData(first, second) {
        try { return JSON.stringify(first || null) === JSON.stringify(second || null); }
        catch(_) { return false; }
    }

    function log(type, detail) {
        try {
            if(typeof window.__plantaoLogRuntimeEvent === 'function') {
                window.__plantaoLogRuntimeEvent(type, detail || {});
            }
        } catch(_) {}
    }

    function status(kind, text) {
        const update = fn('setSalvamentoStatus');
        if(update) {
            try { update(kind, text); } catch(_) {}
        }
    }

    function userMessage(title, body) {
        const toast = fn('showToast');
        if(toast) {
            try { toast(title, body); } catch(_) {}
        }
    }

    function ownerMismatch(data, currentTarget) {
        const ownerId = data?.[OWNER_FIELD]?.userId || data?.ownerUserId || data?.owner_user_id || data?.__ownerUserId;
        return Boolean(ownerId && currentTarget?.userId && String(ownerId) !== String(currentTarget.userId));
    }

    function stampOwner(data, currentTarget, reason) {
        if(!data || !currentTarget?.userId) return;
        data[OWNER_FIELD] = {
            userId: currentTarget.userId,
            dataKey: typeof window.__plantaoGetActiveDataKey === 'function' ? window.__plantaoGetActiveDataKey() : '',
            version: VERSION,
            reason,
            updatedAt: new Date().toISOString()
        };
    }

    async function readRemote(currentTarget) {
        const supabase = client();
        if(!supabase || !currentTarget?.userId) return null;
        const { data, error } = await supabase
            .from('plantao_user_data')
            .select('data,updated_at')
            .eq('user_id', currentTarget.userId)
            .maybeSingle();
        if(error) throw error;
        return data || null;
    }

    function preserveLocalConflict(data, currentTarget) {
        try {
            const suffix = `${currentTarget.userId}_${Date.now()}`.replace(/[^a-z0-9_-]/gi, '-');
            localStorage.setItem(CONFLICT_PREFIX + suffix, JSON.stringify({
                userId: currentTarget.userId,
                createdAt: new Date().toISOString(),
                data: clone(data)
            }));
        } catch(_) {}
    }

    async function createSilentBackup(data, currentTarget, reason) {
        const supabase = client();
        if(!supabase || !data || !currentTarget?.userId) return false;
        try {
            const { error } = await supabase.from(BACKUP_TABLE).insert({
                user_id: currentTarget.userId,
                data: clone(data),
                reason,
                created_at: new Date().toISOString()
            });
            return !error;
        } catch(_) {
            return false;
        }
    }

    function rpcUnavailable(error) {
        const text = String(error?.message || error?.code || '').toLowerCase();
        return error?.code === 'PGRST202' ||
            error?.code === '42883' ||
            text.includes('plantao_save_user_data') && (text.includes('not find') || text.includes('not exist'));
    }

    async function saveAtomic(data, currentTarget, expectedRevision) {
        const supabase = client();
        const payload = {
            p_user_id: currentTarget.userId,
            p_data: data,
            p_email: currentTarget.email || null,
            p_expected_updated_at: expectedRevision || null
        };
        const rpcResult = await supabase.rpc('plantao_save_user_data', payload);
        if(!rpcResult.error) {
            const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
            return {
                atomic: true,
                ok: row?.ok !== false,
                conflict: row?.conflict === true,
                updatedAt: row?.updated_at || null
            };
        }
        if(!rpcUnavailable(rpcResult.error)) throw rpcResult.error;

        // Compatibility path until the database migration is run.
        const latest = await readRemote(currentTarget);
        if(latest?.updated_at && expectedRevision && latest.updated_at !== expectedRevision && !sameData(latest.data, data)) {
            return { atomic: false, ok: false, conflict: true, updatedAt: latest.updated_at };
        }
        const updatedAt = new Date().toISOString();
        const { error } = await supabase.from('plantao_user_data').upsert({
            user_id: currentTarget.userId,
            data,
            email: currentTarget.email || null,
            updated_at: updatedAt
        }, { onConflict: 'user_id' });
        if(error) throw error;
        return { atomic: false, ok: true, conflict: false, updatedAt };
    }

    function install() {
        if(window.__plantaoSyncIntegrityInstalled || !window.__plantaoDataSafetyWrapped) return false;
        const originalLoad = fn('carregarDadosSupabase');
        const originalSave = fn('salvarDadosSupabase');
        if(!originalLoad || !originalSave) return false;

        async function loadWithRevision() {
            const result = await originalLoad.apply(this, arguments);
            const currentTarget = target();
            if(result && currentTarget?.userId) {
                try {
                    const remote = await readRemote(currentTarget);
                    if(remote?.updated_at) rememberRevision(currentTarget.userId, remote.updated_at);
                } catch(_) {}
            }
            return result;
        }

        async function saveWithRevisionProtection() {
            const currentTarget = target();
            const data = dbRef();
            const supabase = client();
            if(!supabase || !currentTarget?.userId || !data) return;
            if(value('dadosSupabaseCarregados') === false) return;
            if(ownerMismatch(data, currentTarget)) {
                log('save-owner-mismatch-blocked-v225', { expected: currentTarget.userId });
                return;
            }

            try {
                if(typeof window.__plantaoRecoverSilently === 'function') window.__plantaoRecoverSilently();
                const remote = await readRemote(currentTarget);
                let expected = knownRevision(currentTarget.userId);
                if(!expected && remote?.updated_at) {
                    expected = remote.updated_at;
                    rememberRevision(currentTarget.userId, expected);
                }

                if(remote?.updated_at && expected && remote.updated_at !== expected && !sameData(remote.data, data)) {
                    preserveLocalConflict(data, currentTarget);
                    await createSilentBackup(data, currentTarget, 'Alteracao local preservada por conflito');
                    status('error', 'Altera\u00e7\u00f5es preservadas neste dispositivo');
                    userMessage('Mudan\u00e7as recentes detectadas', 'Suas altera\u00e7\u00f5es ficaram preservadas neste aparelho. Atualize a p\u00e1gina antes de continuar.');
                    log('cloud-conflict-preserved-v225', { userId: currentTarget.userId });
                    return;
                }

                if(remote?.data && !sameData(remote.data, data)) {
                    await createSilentBackup(remote.data, currentTarget, 'Antes de salvar nova versao');
                }
                const adminBackup = fn('garantirBackupEdicaoAdmin');
                if(adminBackup) await adminBackup({ user_id: currentTarget.userId, email: currentTarget.email || null });

                stampOwner(data, currentTarget, 'revision-safe-save');
                localStorage.setItem('prf_v120', JSON.stringify(data));
                status('saving', 'Salvando...');
                const result = await saveAtomic(data, currentTarget, expected);
                if(result.conflict) {
                    preserveLocalConflict(data, currentTarget);
                    await createSilentBackup(data, currentTarget, 'Alteracao local preservada por conflito');
                    status('error', 'Altera\u00e7\u00f5es preservadas neste dispositivo');
                    userMessage('Mudan\u00e7as recentes detectadas', 'Suas altera\u00e7\u00f5es ficaram preservadas neste aparelho. Atualize a p\u00e1gina antes de continuar.');
                    log('atomic-conflict-preserved-v225', { userId: currentTarget.userId });
                    return;
                }
                rememberRevision(currentTarget.userId, result.updatedAt || new Date().toISOString());
                status('saved', 'Salvo');
                log('cloud-save-v225', { userId: currentTarget.userId, atomic: result.atomic });
            } catch(error) {
                preserveLocalConflict(data, currentTarget);
                status('error', 'Erro ao salvar');
                userMessage('Erro ao salvar suas altera\u00e7\u00f5es', 'As altera\u00e7\u00f5es continuam preservadas neste dispositivo. Tente novamente quando a conex\u00e3o estiver dispon\u00edvel.');
                log('cloud-save-error-v225', { message: String(error?.message || error) });
            }
        }

        loadWithRevision.__plantaoSyncIntegrityWrapped = true;
        saveWithRevisionProtection.__plantaoSyncIntegrityWrapped = true;
        setFn('carregarDadosSupabase', loadWithRevision);
        setFn('salvarDadosSupabase', saveWithRevisionProtection);
        window.__plantaoSyncIntegrityInstalled = true;
        window.__plantaoSyncIntegrityVersion = VERSION;
        try { document.body.dataset.syncIntegrityFix = VERSION; } catch(_) {}
        return true;
    }

    if(!install()) {
        const timer = setInterval(() => {
            if(install()) clearInterval(timer);
        }, 120);
        setTimeout(() => clearInterval(timer), 10000);
    }
})();