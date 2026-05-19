(function plantaoCloudBackupFix() {
    if(window.__plantaoCloudBackupFixInstalled) return;
    window.__plantaoCloudBackupFixInstalled = true;

    const TABLE = 'plantao_user_backups';
    const DISABLED_KEY = 'plantao_cloud_backup_disabled';
    const MIN_INTERVAL = 45000;
    let lastBackupAt = 0;
    let queue = Promise.resolve();
    let cloudRows = [];
    let cloudLoadedAt = 0;
    let cloudLoading = false;

    function clone(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function same(a, b) {
        try { return JSON.stringify(a || null) === JSON.stringify(b || null); } catch(e) { return false; }
    }

    function persisted() {
        try {
            const raw = localStorage.getItem('prf_v120');
            return raw ? JSON.parse(raw) : null;
        } catch(e) {
            return null;
        }
    }

    function summary(data) {
        const meta = data?.metaFixa && typeof data.metaFixa === 'object' ? data.metaFixa : {};
        const tasks = Object.values(meta).flat().filter(Boolean);
        const list = Array.isArray(data?.lista) ? data.lista : [];
        return {
            materias: [...new Set(list.map(item => item?.m).filter(Boolean))].length,
            assuntos: list.length,
            dias: Object.keys(meta).length,
            tarefas: tasks.length,
            concluidas: tasks.filter(task => task?.c).length,
            lancamentos: Array.isArray(data?.lancamentos) ? data.lancamentos.length : 0
        };
    }

    function disabled() {
        try { return sessionStorage.getItem(DISABLED_KEY) === '1'; } catch(e) { return false; }
    }

    function disable() {
        try { sessionStorage.setItem(DISABLED_KEY, '1'); } catch(e) {}
    }

    function target() {
        try {
            if(typeof supabaseClient === 'undefined' || !supabaseClient) return null;
            if(typeof cloudUser === 'undefined' || !cloudUser || cloudUser.provider !== 'supabase') return null;
            const alvo = typeof alvoDadosNuvem === 'function' ? alvoDadosNuvem() : {};
            const user_id = alvo?.user_id || cloudUser.id || cloudUser.uid;
            if(!user_id) return null;
            return { user_id, email: alvo?.email || cloudUser.email || '' };
        } catch(e) {
            return null;
        }
    }

    function handleCloudError(error, label) {
        const msg = String(error?.message || error?.code || error || '').toLowerCase();
        if(error?.code === '42P01' || error?.code === '42501' || msg.includes('schema cache') || msg.includes('not exist') || msg.includes('permission')) {
            disable();
        }
        try { console.warn(`[PLANTAO] ${label}:`, error?.message || error); } catch(e) {}
    }

    function queueBackup(data, reason) {
        if(!data || disabled()) return;
        const alvo = target();
        if(!alvo) return;
        const now = Date.now();
        if(now - lastBackupAt < MIN_INTERVAL) return;
        lastBackupAt = now;
        const payload = {
            user_id: alvo.user_id,
            email: alvo.email || null,
            data: clone(data),
            summary: summary(data),
            reason: reason || 'Antes do salvamento',
            created_at: new Date(now).toISOString()
        };
        queue = queue.catch(() => {}).then(async () => {
            try {
                const { error } = await supabaseClient.from(TABLE).insert(payload);
                if(error) handleCloudError(error, 'Backup em nuvem indisponivel');
                else cloudLoadedAt = 0;
            } catch(e) {
                handleCloudError(e, 'Backup em nuvem indisponivel');
            }
        });
    }

    async function loadCloudHistory(force) {
        const alvo = target();
        if(!alvo || disabled()) return [];
        if(cloudLoading) return cloudRows;
        if(!force && cloudLoadedAt && Date.now() - cloudLoadedAt < 60000) return cloudRows;
        cloudLoading = true;
        try {
            const { data, error } = await supabaseClient
                .from(TABLE)
                .select('id,created_at,reason,summary')
                .eq('user_id', alvo.user_id)
                .order('created_at', { ascending: false })
                .limit(12);
            if(error) handleCloudError(error, 'Historico em nuvem indisponivel');
            else {
                cloudRows = Array.isArray(data) ? data : [];
                cloudLoadedAt = Date.now();
            }
        } catch(e) {
            handleCloudError(e, 'Historico em nuvem indisponivel');
        } finally {
            cloudLoading = false;
        }
        return cloudRows;
    }

    function escapeText(value) {
        if(typeof escapeHtml === 'function') return escapeHtml(value);
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    function renderCloudCard() {
        const grid = document.querySelector('#seguranca-content .safety-grid');
        if(!grid) return;
        let card = document.getElementById('plantao-cloud-history-card');
        if(!card) {
            card = document.createElement('div');
            card.id = 'plantao-cloud-history-card';
            card.className = 'stat-card';
            grid.appendChild(card);
        }
        const alvo = target();
        const status = !alvo
            ? 'Entre na conta para ativar versões na nuvem.'
            : disabled()
                ? 'A tabela plantao_user_backups ainda não está ativa no Supabase.'
                : cloudLoading
                    ? 'Carregando backups da nuvem...'
                    : 'As versões da nuvem aparecerão aqui depois dos próximos salvamentos.';
        const rows = cloudRows.length ? cloudRows.map(row => {
            const r = row.summary || {};
            return `<div class="version-row"><div><strong>${new Date(row.created_at).toLocaleString()}</strong><small>${escapeText(row.reason || 'Backup')} | ${r.assuntos || 0} assuntos | ${r.concluidas || 0} concluídos</small></div><button class="btn btn-sm btn-outline" onclick="window.__plantaoRestoreCloudBackup('${row.id}')">RESTAURAR</button></div>`;
        }).join('') : `<div class="empty-state">${status}</div>`;
        card.innerHTML = `<h3>Histórico na nuvem</h3><div class="safety-list">${rows}</div>`;
    }

    function refreshCloudCard(force) {
        if(!force && cloudLoadedAt && Date.now() - cloudLoadedAt < 60000) {
            renderCloudCard();
            return;
        }
        renderCloudCard();
        loadCloudHistory(force).then(renderCloudCard);
    }

    async function restoreCloudBackup(id) {
        const alvo = target();
        if(!alvo || !id) return;
        if(!confirm('Restaurar este backup da nuvem? O estado atual ficará salvo no histórico local.')) return;
        try {
            const { data, error } = await supabaseClient
                .from(TABLE)
                .select('data')
                .eq('id', id)
                .eq('user_id', alvo.user_id)
                .maybeSingle();
            if(error) throw error;
            if(!data?.data) {
                if(typeof showToast === 'function') showToast('Backup não encontrado', 'Não encontrei os dados dessa versão na nuvem.');
                return;
            }
            if(typeof window.__plantaoUndoLastChange === 'function' && typeof db !== 'undefined') {
                try { localStorage.setItem(`plantao_undo_v1_${Date.now()}`, JSON.stringify(db)); } catch(e) {}
            }
            db = clone(data.data);
            try { if(typeof normalizarBanco === 'function') normalizarBanco(); } catch(e) {}
            try { if(typeof save === 'function') save(); } catch(e) {}
            try { if(typeof init === 'function') init(); } catch(e) {}
            if(typeof showToast === 'function') showToast('Backup restaurado', 'O planejamento voltou para a versão salva na nuvem.');
        } catch(e) {
            handleCloudError(e, 'Falha ao restaurar backup');
            if(typeof showToast === 'function') showToast('Falha ao restaurar backup', 'Confira a tabela plantao_user_backups e tente novamente.');
        }
    }

    function wrap() {
        if(typeof save === 'function' && !save.__plantaoCloudBackupWrapped) {
            const original = save;
            save = function saveWithCloudBackup() {
                const previous = persisted();
                if(previous && typeof db !== 'undefined' && !same(previous, db)) {
                    queueBackup(previous, 'Antes do salvamento');
                }
                return original.apply(this, arguments);
            };
            save.__plantaoCloudBackupWrapped = true;
        }

        if(typeof showTab === 'function' && !showTab.__plantaoCloudBackupWrapped) {
            const originalShowTab = showTab;
            showTab = function showTabWithCloudBackup(id, el) {
                const result = originalShowTab.apply(this, arguments);
                if(id === 'seguranca') refreshCloudCard(false);
                return result;
            };
            showTab.__plantaoCloudBackupWrapped = true;
        }

        if(typeof renderSegurancaDados === 'function' && !renderSegurancaDados.__plantaoCloudBackupWrapped) {
            const originalSecurity = renderSegurancaDados;
            renderSegurancaDados = function renderSecurityWithCloudHistory() {
                const result = originalSecurity.apply(this, arguments);
                refreshCloudCard(false);
                return result;
            };
            renderSegurancaDados.__plantaoCloudBackupWrapped = true;
        }
    }

    window.__plantaoRestoreCloudBackup = restoreCloudBackup;
    window.__plantaoRefreshCloudBackups = () => refreshCloudCard(true);

    function install() {
        wrap();
        if(document.querySelector('.page.active')?.id === 'seguranca') refreshCloudCard(false);
        return typeof save === 'function' && typeof showTab === 'function';
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();

    const timer = setInterval(() => {
        if(install()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 10000);
})();
