(function plantaoStrictAccountGuard() {
    if(window.__plantaoStrictAccountGuardRequested) return;
    window.__plantaoStrictAccountGuardRequested = true;

    const VERSION = 'v245-own-remote-row';
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

    function setValue(name, replacement) {
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

    function ownedDefaultData(currentTarget, reason) {
        return stampOwner(defaultData(), currentTarget, reason);
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

    function activeDataOwner(identity, forced = false) {
        try {
            if(typeof window.__plantaoSetDataOwner === 'function') return window.__plantaoSetDataOwner(identity, forced);
        } catch(_) {}
        return null;
    }

    function clearForcedOwner() {
        try { window.__plantaoForcedDataKey = ''; } catch(_) {}
        try {
            const user = value('cloudUser', null);
            if(user?.id) activeDataOwner(user.id, false);
        } catch(_) {}
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
        try { fn('init')?.(); } catch(_) {}
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

    async function createEmptyRemote(currentTarget, data = null, reason = 'strict-empty-remote') {
        try {
            const supabase = client();
            if(!supabase || !currentTarget?.userId) return false;
            const payloadData = stampOwner(clone(data || defaultData()), currentTarget, reason);
            const payload = {
                user_id: currentTarget.userId,
                email: currentTarget.email || null,
                data: payloadData,
                updated_at: new Date().toISOString()
            };
            const result = await supabase.from('plantao_user_data').upsert(payload, { onConflict: 'user_id' });
            if(result?.error) throw result.error;
            log('strict-empty-remote-created', { userId: currentTarget.userId, reason });
            return true;
        } catch(error) {
            log('strict-empty-remote-create-error', { userId: currentTarget?.userId || null, reason, message: String(error?.message || error) });
            return false;
        }
    }

    async function ensureRemoteRow(currentTarget, reason = 'strict-ensure-remote-row') {
        if(!client() || !currentTarget?.userId) return false;
        const { row, error } = await readRemote(currentTarget);
        if(error) throw error;
        if(row?.data) {
            if(ownerMismatch(row.data, currentTarget)) {
                preserveQuarantine(row.data, currentTarget, `${reason}-owner-mismatch`);
                log('strict-ensure-remote-owner-mismatch', { userId: currentTarget.userId, reason });
                return false;
            }
            return true;
        }
        return createEmptyRemote(currentTarget, ownedDefaultData(currentTarget, reason), reason);
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

                if(isEditingStudent()) {
                    const emptyStudentData = ownedDefaultData(currentTarget, 'strict-empty-student-remote');
                    const created = await createEmptyRemote(currentTarget, emptyStudentData, 'strict-empty-student-remote');
                    if(!created) return blockLoad(currentTarget, 'student-empty-remote-create-failed');
                    return finalizeLoadedData(emptyStudentData, currentTarget, 'strict-empty-student-remote');
                }
                const current = state();
                if(score(current) > 0 && !ownerOf(current)) preserveQuarantine(current, currentTarget, 'remote-empty-ownerless-local');
                if(ownerMismatch(current, currentTarget)) preserveQuarantine(current, currentTarget, 'remote-empty-owner-mismatch-local');
                const emptyData = ownedDefaultData(currentTarget, 'strict-empty-remote');
                finalizeLoadedData(emptyData, currentTarget, 'strict-empty-remote');
                await createEmptyRemote(currentTarget, state(), 'strict-empty-remote');
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

    function installAdminSwitchGuard() {
        const originalOpen = fn('entrarPerfilAluno');
        const originalBack = fn('voltarPerfilAdmin');
        if(originalOpen && !originalOpen.__plantaoStrictAdminSwitchWrapped) {
            async function entrarPerfilAlunoEstrito(email) {
                const supabase = client();
                const isAdmin = fn('usuarioAdmin');
                if(!supabase || !(isAdmin && isAdmin())) return originalOpen.apply(this, arguments);

                const cleanEmail = decodeURIComponent(String(email || '')).toLowerCase();
                const accessList = value('adminAccessList', []);
                const aluno = Array.isArray(accessList)
                    ? accessList.find(item => String(item.email || '').toLowerCase() === cleanEmail)
                    : null;
                const toast = fn('showToast');
                if(!aluno || aluno.status !== 'approved') {
                    toast?.('Aluno nao aprovado', 'Aprove o aluno antes de abrir o perfil.');
                    return;
                }
                if(!aluno.user_id) {
                    toast?.('Aluno sem login completo', 'Esse aluno precisa entrar pelo Google ou e-mail uma vez antes de editar os dados dele.');
                    return;
                }

                const nomeAlunoFn = fn('nomePublicoAluno');
                const nomeAluno = nomeAlunoFn ? nomeAlunoFn(aluno) : (aluno.name || cleanEmail || 'Aluno');
                const confirm = fn('confirmarAcaoPlano');
                if(confirm && !confirm('Abrir perfil de aluno', `Voce vai editar os dados de ${nomeAluno}. Confirme para evitar alterar o aluno errado.`)) return;

                const adminUser = value('cloudUser', null);
                const adminTarget = adminUser?.id ? { userId: String(adminUser.id), email: adminUser.email || null } : null;
                const current = state();
                if(adminTarget && !ownerMismatch(current, adminTarget)) {
                    await fn('salvarDadosSupabase')?.(true);
                } else if(current && score(current) > 0) {
                    preserveQuarantine(current, adminTarget, 'admin-open-student-owner-mismatch-before-save');
                }

                activeDataOwner(aluno.user_id, true);
                setValue('adminStudentContext', {
                    user_id: aluno.user_id,
                    email: cleanEmail,
                    name: nomeAluno
                });
                setValue('adminEditBackupReady', false);
                window.__plantaoCloudDataReady = false;

                const loaded = await fn('carregarDadosSupabase')?.();
                if(!loaded) {
                    setValue('adminStudentContext', null);
                    setValue('adminEditBackupReady', false);
                    clearForcedOwner();
                    await fn('carregarDadosSupabase')?.();
                    return;
                }

                fn('renderAdminStudentBanner')?.();
                fn('renderPerfil')?.();
                fn('updateDashboard')?.();
                const showTab = fn('showTab');
                if(showTab) showTab('diaria', document.querySelector(".nav-item[onclick*='diaria']") || document.querySelector('.nav-item'));
                else fn('renderDiario')?.(value('vDate', new Date()));
            }
            entrarPerfilAlunoEstrito.__plantaoStrictAdminSwitchWrapped = true;
            entrarPerfilAlunoEstrito.__plantaoOriginal = originalOpen;
            setFn('entrarPerfilAluno', entrarPerfilAlunoEstrito);
        }

        if(originalBack && !originalBack.__plantaoStrictAdminSwitchWrapped) {
            async function voltarPerfilAdminEstrito() {
                const editing = isEditingStudent();
                if(!editing) return originalBack.apply(this, arguments);
                const currentTarget = target();
                if(currentTarget?.userId && !ownerMismatch(state(), currentTarget)) {
                    await fn('salvarDadosSupabase')?.(true);
                }
                setValue('adminStudentContext', null);
                setValue('adminEditBackupReady', false);
                clearForcedOwner();
                const loaded = await fn('carregarDadosSupabase')?.();
                if(loaded) {
                    fn('renderAdminStudentBanner')?.();
                    fn('renderPerfil')?.();
                    fn('updateDashboard')?.();
                    const showTab = fn('showTab');
                    if(showTab) showTab('perfil', document.querySelector(".nav-item[onclick*='perfil']"));
                }
            }
            voltarPerfilAdminEstrito.__plantaoStrictAdminSwitchWrapped = true;
            voltarPerfilAdminEstrito.__plantaoOriginal = originalBack;
            setFn('voltarPerfilAdmin', voltarPerfilAdminEstrito);
        }

        return Boolean(fn('entrarPerfilAluno')?.__plantaoStrictAdminSwitchWrapped);
    }

    function installApprovalGuard() {
        const original = fn('alterarAcessoAluno');
        if(typeof original !== 'function' || original.__plantaoStrictApprovalWrapped) return Boolean(original?.__plantaoStrictApprovalWrapped);
        async function alterarAcessoAlunoEstrito(email, statusValue) {
            const result = await original.apply(this, arguments);
            if(String(statusValue || '').toLowerCase() !== 'approved') return result;
            const cleanEmail = decodeURIComponent(String(email || '')).toLowerCase();
            const accessList = value('adminAccessList', []);
            const aluno = Array.isArray(accessList)
                ? accessList.find(item => String(item.email || '').toLowerCase() === cleanEmail)
                : null;
            if(!aluno?.user_id) {
                log('strict-approval-without-user-id', { email: cleanEmail });
                return result;
            }
            const nomeAlunoFn = fn('nomePublicoAluno');
            const currentTarget = {
                userId: String(aluno.user_id),
                email: cleanEmail,
                name: nomeAlunoFn ? nomeAlunoFn(aluno) : (aluno.name || cleanEmail || 'Aluno')
            };
            try {
                await ensureRemoteRow(currentTarget, 'strict-approval-empty-row');
            } catch(error) {
                log('strict-approval-empty-row-error', { userId: currentTarget.userId, message: String(error?.message || error) });
            }
            return result;
        }
        alterarAcessoAlunoEstrito.__plantaoStrictApprovalWrapped = true;
        alterarAcessoAlunoEstrito.__plantaoOriginal = original;
        setFn('alterarAcessoAluno', alterarAcessoAlunoEstrito);
        return true;
    }

    function install() {
        const loadReady = installLoadGuard();
        const saveReady = installSaveGuard();
        const switchReady = installAdminSwitchGuard();
        installApprovalGuard();
        return loadReady && saveReady && switchReady;
    }

    install();
    const timer = setInterval(install, 250);
    setTimeout(() => clearInterval(timer), 15000);
})();
