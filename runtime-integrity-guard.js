(function plantaoRuntimeIntegrityGuard() {
    if(window.__plantaoRuntimeIntegrityGuard) return;
    window.__plantaoRuntimeIntegrityGuard = true;

    const VERSION = 'v230-runtime-integrity';
    const SAFE_SYNC_VERSION = 'v229-conditional-revision-save';
    const OWNER_FIELD = '__plantaoOwner';
    const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

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

    function state() {
        return value('db', null);
    }

    function cloudTarget() {
        const target = fn('alvoDadosNuvem');
        if(target) {
            const found = target();
            if(found?.user_id) return found;
        }
        const user = value('cloudUser', null);
        return user?.id ? { user_id: user.id, email: user.email || null } : null;
    }

    function localIsoDate(date = new Date()) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function isUntouchedStarterData(data) {
        const list = Array.isArray(data?.lista) ? data.lista : [];
        if(!list.length || list.length > 3 || data?.[OWNER_FIELD]) return false;
        const expected = new Set(['portugues', 'raciocinio logico', 'direito penal']);
        const names = list.map(item => String(item?.m || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
        const tasks = Object.values(data?.metaFixa || {}).flat().filter(Boolean);
        return names.every(name => expected.has(name)) &&
            !tasks.some(task => task?.c) &&
            !(Array.isArray(data?.lancamentos) && data.lancamentos.length) &&
            !(Array.isArray(data?.historicoEstudos) && data.historicoEstudos.length);
    }

    function removeUntouchedStarterData() {
        const data = state();
        if(!isUntouchedStarterData(data)) return false;
        data.lista = [];
        data.ciclo = [];
        data.metaFixa = {};
        try { localStorage.setItem('prf_v120', JSON.stringify(data)); } catch(_) {}
        return true;
    }

    function disableLegacyRecovery() {
        const recovery = fn('recuperarLancamentosAdminConhecidos');
        if(!recovery || recovery.__plantaoDisabled) return false;
        function legacyRecoveryDisabled() { return false; }
        legacyRecoveryDisabled.__plantaoDisabled = true;
        setFn('recuperarLancamentosAdminConhecidos', legacyRecoveryDisabled);
        return true;
    }

    function wrapDataLoad() {
        const original = fn('carregarDadosSupabase');
        if(!original || original.__plantaoStarterGuard) return false;
        async function loadWithoutStarterPlan() {
            removeUntouchedStarterData();
            return original.apply(this, arguments);
        }
        loadWithoutStarterPlan.__plantaoStarterGuard = true;
        setFn('carregarDadosSupabase', loadWithoutStarterPlan);
        return true;
    }

    function preserveConflict(data, target) {
        try {
            localStorage.setItem(`plantao_conflict_copy_v1_${target.user_id}_${Date.now()}`, JSON.stringify(data));
        } catch(_) {}
    }

    function wrapLegacySave() {
        if(window.__plantaoSyncIntegrityVersion === SAFE_SYNC_VERSION) return true;
        const original = fn('salvarDadosSupabase');
        const client = value('supabaseClient', null);
        if(!window.__plantaoSyncIntegrityInstalled || !original || original.__plantaoRuntimeConditionalSave || !client) return false;

        async function conditionalSave() {
            const data = state();
            const target = cloudTarget();
            if(!data || !target?.user_id || value('dadosSupabaseCarregados', false) === false) return;
            if(data?.[OWNER_FIELD]?.userId && String(data[OWNER_FIELD].userId) !== String(target.user_id)) return;
            const setStatus = fn('setSalvamentoStatus');
            const toast = fn('showToast');
            try {
                setStatus?.('saving', 'Salvando...');
                const current = await client.from('plantao_user_data').select('data,updated_at').eq('user_id', target.user_id).maybeSingle();
                if(current.error) throw current.error;
                if(current.data?.data && fn('salvariaPerdaCritica')?.(data, current.data.data)) {
                    preserveConflict(data, target);
                    toast?.('Altera\u00e7\u00f5es preservadas', 'H\u00e1 uma vers\u00e3o mais completa salva. Atualize a p\u00e1gina antes de continuar.');
                    return;
                }
                if(current.data?.data) {
                    try {
                        await client.from('plantao_user_backups').insert({
                            user_id: target.user_id,
                            data: current.data.data,
                            reason: 'Antes de salvar nova versao',
                            created_at: new Date().toISOString()
                        });
                    } catch(_) {}
                }
                const row = { user_id: target.user_id, data, email: target.email || null, updated_at: new Date().toISOString() };
                if(current.data?.updated_at) {
                    const result = await client.from('plantao_user_data').update(row).eq('user_id', target.user_id).eq('updated_at', current.data.updated_at).select('updated_at').maybeSingle();
                    if(result.error) throw result.error;
                    if(!result.data?.updated_at) {
                        preserveConflict(data, target);
                        toast?.('Altera\u00e7\u00f5es preservadas', 'Outra atualiza\u00e7\u00e3o foi salva primeiro. Recarregue a p\u00e1gina antes de continuar.');
                        return;
                    }
                } else {
                    const result = await client.from('plantao_user_data').insert(row);
                    if(result.error?.code === '23505') {
                        preserveConflict(data, target);
                        toast?.('Altera\u00e7\u00f5es preservadas', 'Outra atualiza\u00e7\u00e3o foi salva primeiro. Recarregue a p\u00e1gina antes de continuar.');
                        return;
                    }
                    if(result.error) throw result.error;
                }
                setStatus?.('saved', 'Salvo');
            } catch(_) {
                preserveConflict(data, target);
                setStatus?.('error', 'Erro ao salvar');
                toast?.('N\u00e3o foi poss\u00edvel salvar agora', 'Suas altera\u00e7\u00f5es continuam preservadas neste dispositivo.');
            }
        }
        conditionalSave.__plantaoRuntimeConditionalSave = true;
        setFn('salvarDadosSupabase', conditionalSave);
        return true;
    }

    function wrapSuggestedErrorDate() {
        const original = fn('criarErroSugerido');
        if(!original || original.__plantaoLocalDateGuard) return false;
        function suggestedWithLocalDate() {
            const before = new Set((state()?.errosEstudo || []).map(item => item.id));
            const result = original.apply(this, arguments);
            const item = (state()?.errosEstudo || []).find(row => !before.has(row.id));
            const utcValue = new Date().toISOString().slice(0, 10);
            const localValue = localIsoDate();
            if(item && utcValue !== localValue && item.data === utcValue) {
                item.data = localValue;
                fn('save')?.();
                fn('renderCadernoErros')?.();
            }
            return result;
        }
        suggestedWithLocalDate.__plantaoLocalDateGuard = true;
        setFn('criarErroSugerido', suggestedWithLocalDate);
        return true;
    }

    function redactTeacherPanel() {
        const panel = document.getElementById('study-admin-panel');
        if(!panel) return;
        const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) {
            const node = walker.currentNode;
            const clean = node.nodeValue.replace(EMAIL_RE, '').replace(/\s{2,}/g, ' ');
            EMAIL_RE.lastIndex = 0;
            if(clean !== node.nodeValue) node.nodeValue = clean;
        }
    }

    function repairDateInputs() {
        const utcValue = new Date().toISOString().slice(0, 10);
        const localValue = localIsoDate();
        if(utcValue === localValue) return;
        ['erro-data', 'sim-data'].forEach(id => {
            const input = document.getElementById(id);
            if(input?.value === utcValue) input.value = localValue;
        });
    }

    function installVisualPatch() {
        if(document.getElementById('plantao-v229-visual-patch')) return;
        const style = document.createElement('style');
        style.id = 'plantao-v229-visual-patch';
        style.textContent = `
            .logo-box { background: transparent !important; border-color: transparent !important; box-shadow: none !important; color: #0f172a !important; }
            .btn.btn-outline, button.btn.btn-outline { background: #fff !important; border-color: #cbd5e1 !important; color: #334155 !important; }
            .btn.btn-outline:hover, button.btn.btn-outline:hover { background: #f8fafc !important; border-color: #94a3b8 !important; color: #0f172a !important; }
            .feedback-box { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; color: #0f172a !important; }
            .feedback-box strong, .feedback-box span, .feedback-box p { color: inherit !important; }
            .login-card .btn.btn-link { background: transparent !important; border: 0 !important; box-shadow: none !important; color: #2563eb !important; min-height: 40px; }
            .login-card .btn.btn-link:hover { background: #eff6ff !important; color: #1d4ed8 !important; }
        `;
        document.head.appendChild(style);
    }

    function install() {
        installVisualPatch();
        disableLegacyRecovery();
        wrapDataLoad();
        wrapLegacySave();
        wrapSuggestedErrorDate();
        redactTeacherPanel();
        repairDateInputs();
        document.documentElement.dataset.runtimeIntegrityGuard = VERSION;
    }

    install();
    const observer = new MutationObserver(() => {
        redactTeacherPanel();
        repairDateInputs();
    });
    if(document.body) observer.observe(document.body, { childList: true, subtree: true });
    else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });
    const timer = setInterval(install, 250);
    setTimeout(() => clearInterval(timer), 12000);
})();
