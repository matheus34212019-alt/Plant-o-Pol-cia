(function plantaoIntegrityUiFix() {
    if(window.__plantaoIntegrityUiFix) return;
    window.__plantaoIntegrityUiFix = true;

    const VERSION = 'v224-integrity-ui';
    const WRAPPED = '__plantaoIntegrityUiWrapped';
    const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function value(name, fallback = null) {
        try { return Function(`return typeof ${name} === "undefined" ? null : ${name};`)() ?? fallback; }
        catch(_) { return fallback; }
    }

    function setFn(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch(_) {}
        try { window[name] = replacement; } catch(_) {}
    }

    function state() {
        return value('db', window.db || null);
    }

    function esc(input) {
        return String(input ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function displayName(input, fallback = 'Aluno') {
        const clean = String(input || '')
            .replace(EMAIL_RE, '')
            .replace(/\s+\|\s*$/, '')
            .replace(/^\s+\|\s*/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        EMAIL_RE.lastIndex = 0;
        return clean || fallback;
    }

    function plainText(input) {
        return String(input ?? '').replace(/[<>"'`]/g, '').trim();
    }

    function sanitizeState() {
        const data = state();
        if(!data || typeof data !== 'object') return;
        data.perfilNome = plainText(data.perfilNome).slice(0, 80);
        (Array.isArray(data.lista) ? data.lista : []).forEach(item => {
            item.m = plainText(item.m).slice(0, 120);
            item.a = plainText(item.a).slice(0, 300);
        });
        if(Array.isArray(data.ciclo)) data.ciclo = data.ciclo.map(item => plainText(item).slice(0, 120));
        Object.values(data.metaFixa || {}).forEach(tasks => {
            (Array.isArray(tasks) ? tasks : []).forEach(task => {
                task.m = plainText(task.m).slice(0, 120);
                task.a = plainText(task.a).slice(0, 300);
                task.l = plainText(task.l).slice(0, 60);
            });
        });
        (Array.isArray(data.historicoEstudos) ? data.historicoEstudos : []).forEach(row => {
            if(!row?.task) return;
            row.task.m = plainText(row.task.m).slice(0, 120);
            row.task.a = plainText(row.task.a).slice(0, 300);
            row.task.l = plainText(row.task.l).slice(0, 60);
        });
        (Array.isArray(data.simulados) ? data.simulados : []).forEach(item => {
            item.nome = plainText(item.nome).slice(0, 120);
        });
    }

    function patchBeforeRender(name) {
        const original = fn(name);
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function safeRender() {
            sanitizeState();
            return original.apply(this, arguments);
        }
        safeRender[WRAPPED] = true;
        safeRender.__plantaoOriginal = original;
        setFn(name, safeRender);
        return true;
    }

    function installSanitizingSave() {
        const original = fn('save');
        if(typeof original !== 'function' || original.__plantaoIntegritySave) return false;
        function safeSave() {
            sanitizeState();
            return original.apply(this, arguments);
        }
        safeSave.__plantaoIntegritySave = true;
        safeSave.__plantaoOriginal = original;
        setFn('save', safeSave);
        return true;
    }

    function installPublicNames() {
        const safeStudentName = function nomePublicoAlunoSeguro(student, data, fallback = 'Aluno') {
            const options = [data?.perfilNome, student?.perfilNome, student?.name, student?.display_name, student?.full_name];
            for(const option of options) {
                const found = displayName(option, '');
                if(found) return found;
            }
            return fallback;
        };
        safeStudentName[WRAPPED] = true;
        setFn('nomePublicoAluno', safeStudentName);
        const safeLogin = function loginUsuarioSeguro() {
            const profile = value('accessProfile', null);
            const cloud = value('cloudUser', null);
            if(!cloud) return 'Acesso local';
            if(profile?.role === 'admin') return 'Administrador';
            return 'Aluno';
        };
        safeLogin[WRAPPED] = true;
        setFn('loginUsuario', safeLogin);
    }

    function installSafeToast() {
        const original = fn('showToast');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function safeToast(title, text) {
            const message = `${title || ''} ${text || ''}`;
            const internal = /dados sincronizados|nuvem ativada|backup .*criado|salvo na nuvem|diagn[oó]stico|seguran[cç]a/i.test(message);
            const important = /falha|erro|bloquead|indispon[ií]vel|senha|login|permiss[aã]o/i.test(message);
            if(internal && !important) return;
            const area = document.getElementById('toast-area');
            if(!area) return;
            const card = document.createElement('div');
            card.className = 'toast-card';
            const strong = document.createElement('strong');
            strong.textContent = String(title || '');
            const small = document.createElement('small');
            small.textContent = String(text || '');
            card.append(strong, small);
            area.appendChild(card);
            setTimeout(() => card.remove(), 3600);
        }
        safeToast[WRAPPED] = true;
        safeToast.__plantaoOriginal = original;
        setFn('showToast', safeToast);
        return true;
    }

    function installQuietLoginStatus() {
        const original = fn('setCloudStatus');
        if(typeof original !== 'function' || original.__plantaoQuietStatus) return false;
        function quietStatus(message) {
            const text = String(message || '');
            const procedural = /supabase|verificando login|carregando seus dados|dados sincronizados|nuvem ativada|salvando/i.test(text);
            const important = /falha|erro|senha|login (?:google )?(?:cancelado|bloqueado)|n[aã]o foi poss[ií]vel|permiss[aã]o|aprov|cadastro/i.test(text);
            return original.call(this, procedural && !important ? 'Entre com Google ou e-mail para continuar.' : text);
        }
        quietStatus.__plantaoQuietStatus = true;
        quietStatus.__plantaoOriginal = original;
        setFn('setCloudStatus', quietStatus);
        const current = document.getElementById('cloud-login-status');
        if(current && /supabase|verificando login|carregando seus dados/i.test(current.textContent || '')) {
            current.textContent = 'Entre com Google ou e-mail para continuar.';
        }
        return true;
    }

    function installSafeTaskCard() {
        const original = fn('renderTaskCard');
        if(typeof original !== 'function' || original.__plantaoSafeTaskCard) return false;
        function safeTaskCard(task, day, index, overdue) {
            const data = state();
            const realIndex = overdue && Array.isArray(data?.metaFixa?.[day]) ? Math.max(0, data.metaFixa[day].indexOf(task)) : index;
            const timerId = String(`${day}-${realIndex}-${task?.itemId || task?.id || index}`).replace(/[^a-z0-9-]/gi, '-');
            const type = task?.k === 'Ex' ? 'ex' : (task?.k === 'Rev' ? 'rev' : 'e');
            const safeDay = String(day || '').replace(/[^0-9/]/g, '');
            return `
                <div class="task-card ${task?.c ? 'done' : ''}" style="border-left-color:var(--color-${type})">
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px; gap:12px;">
                            <span class="tag tag-${type}">${esc(task?.l)}</span>
                            <small style="font-weight:700;">${overdue ? 'ATRASO - ' : ''}${esc(safeDay)} | ${(Number.parseFloat(task?.h) || 0).toFixed(1)}h</small>
                        </div>
                        <div style="font-weight:800; font-size:1.1rem;">${esc(task?.m)}</div>
                        <div style="font-size:0.85rem; color:var(--text-sec); margin-bottom:10px;">${esc(task?.a)}</div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button class="btn btn-sm btn-outline" id="btn-t-${timerId}" onclick="toggleTimer('${timerId}', '${safeDay}', ${realIndex})"><i class="fas fa-play"></i></button>
                            <span id="time-${timerId}" style="font-family:monospace; font-weight:800; color:var(--accent);">00:00</span>
                        </div>
                    </div>
                    <input type="checkbox" ${task?.c ? 'checked' : ''} onclick="cliqueTask('${safeDay}', ${realIndex})">
                </div>`;
        }
        safeTaskCard.__plantaoSafeTaskCard = true;
        safeTaskCard.__plantaoOriginal = original;
        setFn('renderTaskCard', safeTaskCard);
        return true;
    }

    function safeAvatar() {
        const avatar = String(fn('avatarUsuario')?.() || '');
        return /^https:\/\//i.test(avatar) ? avatar : '';
    }

    function renderProfileWithoutPrivateData() {
        const target = document.getElementById('perfil-content');
        if(!target) return;
        sanitizeState();
        const data = state() || {};
        const name = displayName(fn('nomeUsuario')?.(), 'Aluno');
        const nameHtml = esc(name);
        const avatar = safeAvatar();
        const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]?.toUpperCase()).join('') || 'P';
        const admin = Boolean(fn('usuarioAdmin')?.());
        const editing = Boolean(fn('editandoAlunoComoAdmin')?.());
        const status = value('accessProfile', null)?.status === 'approved' ? 'Aprovado' : 'Conta conectada';
        const detail = editing ? 'Editando o planejamento selecionado.' : 'Suas alteracoes sao salvas na conta conectada.';
        const adminPanel = admin ? `
            <div class="stat-card admin-access-card">
                <div class="admin-access-head"><div><h3>Alunos</h3><p class="meta-sub">Gerencie acessos e planejamentos sem exibir dados de login.</p></div><button class="btn btn-sm btn-outline" onclick="carregarSolicitacoesAcesso()"><i class="fas fa-rotate"></i> ATUALIZAR</button></div>
                <div id="admin-access-list" class="admin-access-list"><div class="empty-state">Carregando alunos...</div></div>
            </div>` : '';
        target.innerHTML = `
            <div class="profile-grid">
                <div class="stat-card profile-main-card"><div class="profile-avatar">${avatar ? `<img src="${esc(avatar)}" alt="Foto de perfil">` : `<span>${esc(initials)}</span>`}</div><div><small>Conta conectada</small><h3>${nameHtml}</h3><p>${esc(detail)}</p></div></div>
                <div class="stat-card profile-info-card"><div class="profile-info-row"><span>Nome</span><strong>${nameHtml}</strong></div><div class="profile-info-row"><span>Perfil</span><strong>${esc(fn('loginUsuario')?.() || 'Aluno')}</strong></div><div class="profile-info-row"><span>Status</span><strong>${esc(status)}</strong></div></div>
                <div class="stat-card profile-actions-card"><h3>Nome na plataforma</h3><p class="meta-sub">Este nome aparece nas telas de acompanhamento.</p><label for="perfil-nome-aluno">Nome exibido</label><input type="text" id="perfil-nome-aluno" value="${nameHtml}" maxlength="80" placeholder="Nome do aluno"><button class="btn" onclick="salvarNomePerfil()"><i class="fas fa-user-check"></i> SALVAR NOME</button></div>
                <div class="stat-card profile-actions-card"><h3>Acesso</h3><p class="meta-sub">Saia desta conta para entrar com outro usuario neste dispositivo.</p><button class="btn btn-outline" onclick="sairGoogle()"><i class="fas fa-right-from-bracket"></i> SAIR DO LOGIN</button></div>
                <div class="stat-card profile-deadline-card"><h3>Data do edital</h3><label for="edital-publicacao">Publicacao do edital</label><input type="date" id="edital-publicacao" value="${esc(data.editalPublicacao || '')}"><button class="btn" onclick="salvarDataEdital()"><i class="fas fa-calendar-check"></i> SALVAR DATA</button></div>
                ${adminPanel}
            </div>`;
        if(admin) fn('carregarSolicitacoesAcesso')?.();
        fn('renderAdminStudentBanner')?.();
    }

    function installSafeProfile() {
        renderProfileWithoutPrivateData.__plantaoSafeProfile = true;
        setFn('renderPerfil', renderProfileWithoutPrivateData);
    }

    function installSafeStudentBanner() {
        function safeBanner() {
            const banner = document.getElementById('admin-student-banner');
            if(!banner) return;
            if(!fn('editandoAlunoComoAdmin')?.()) { banner.style.display = 'none'; banner.innerHTML = ''; return; }
            const context = value('adminStudentContext', {});
            banner.style.display = 'flex';
            banner.innerHTML = `<div><strong>Editando perfil de aluno</strong><span>${esc(displayName(context?.name, 'Aluno'))}</span></div><button class="btn btn-sm btn-outline" onclick="voltarPerfilAdmin()"><i class="fas fa-user-shield"></i> VOLTAR PARA ADMIN</button>`;
        }
        safeBanner.__plantaoSafeStudentBanner = true;
        setFn('renderAdminStudentBanner', safeBanner);
    }

    function installSafeAdminList() {
        function safeList() {
            const target = document.getElementById('admin-access-list');
            if(!target) return;
            const adminEmail = String(value('ADMIN_EMAIL', ''));
            const students = (value('adminAccessList', []) || []).filter(item => String(item.email || '') !== adminEmail);
            if(!students.length) { target.innerHTML = '<div class="empty-state"><strong>Nenhum aluno cadastrado.</strong></div>'; return; }
            target.innerHTML = students.map(item => {
                const key = encodeURIComponent(String(item.email || ''));
                const name = esc(fn('nomePublicoAluno')?.(item) || 'Aluno');
                const status = item.status === 'approved' ? 'Aprovado' : (item.status === 'rejected' ? 'Recusado' : 'Pendente');
                const actions = item.status === 'approved' ? `<button class="btn btn-sm btn-outline" onclick="entrarPerfilAluno('${key}')">EDITAR PERFIL</button><button class="btn btn-sm btn-outline danger-btn" onclick="alterarAcessoAluno('${key}', 'rejected')">REVOGAR</button>` : `<button class="btn btn-sm" onclick="alterarAcessoAluno('${key}', 'approved')">APROVAR</button><button class="btn btn-sm btn-outline danger-btn" onclick="alterarAcessoAluno('${key}', 'rejected')">RECUSAR</button>`;
                return `<div class="admin-access-row"><div><b>${name}</b><small>${esc(item.contest || 'Concurso nao informado')}</small></div><span class="access-pill ${esc(item.status || 'pending')}">${status}</span><div class="admin-access-actions">${actions}</div></div>`;
            }).join('');
        }
        safeList.__plantaoSafeAdminList = true;
        setFn('renderAdminAccessList', safeList);
    }

    function install() {
        sanitizeState();
        installPublicNames();
        installSafeToast();
        installQuietLoginStatus();
        installSanitizingSave();
        installSafeTaskCard();
        installSafeProfile();
        installSafeStudentBanner();
        installSafeAdminList();
        ['normalizarBanco', 'renderTree', 'renderReverSinalizados', 'renderFluxo', 'renderCiclo', 'renderDiario', 'renderSemanal', 'renderLancamentos', 'renderPerformance', 'renderRankingAlunos', 'renderPainelProfessor', 'renderEvolucaoEstudo'].forEach(patchBeforeRender);
        document.documentElement.dataset.integrityUi = VERSION;
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
    const retry = setInterval(install, 300);
    setTimeout(() => clearInterval(retry), 10000);
})();
