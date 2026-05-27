(function plantaoFinalSystemReview() {
    if(window.__plantaoFinalSystemReview) return;
    window.__plantaoFinalSystemReview = true;

    const VERSION = 'v240-final-system-review';
    const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const adminActionTargets = new Map();
    let adminActionRevision = 0;

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

    function esc(input) {
        return String(input ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function hasEmail(input) {
        EMAIL_RE.lastIndex = 0;
        const found = EMAIL_RE.test(String(input || ''));
        EMAIL_RE.lastIndex = 0;
        return found;
    }

    function displayName(input, fallback = 'Aluno') {
        EMAIL_RE.lastIndex = 0;
        const clean = String(input || '')
            .replace(EMAIL_RE, '')
            .replace(/\s+\|\s*$/, '')
            .replace(/^\s+\|\s*/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        EMAIL_RE.lastIndex = 0;
        return clean || fallback;
    }

    function cleanText(input) {
        return String(input ?? '').replace(/[<>"'`]/g, '').trim();
    }

    function installFinalStyle() {
        if(document.getElementById('plantao-final-system-style')) return;
        const style = document.createElement('style');
        style.id = 'plantao-final-system-style';
        style.textContent = `
            .logo-box {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                width: 216px !important;
                max-width: calc(100% - 16px) !important;
                min-height: 58px !important;
                height: 58px !important;
                flex: 0 0 58px !important;
                margin: 0 8px 22px !important;
                padding: 0 8px !important;
                color: #0f172a !important;
                white-space: nowrap !important;
                line-height: 1 !important;
                transition: none !important;
                animation: none !important;
                transform: none !important;
                box-sizing: border-box !important;
            }
            .logo-box i {
                display: inline-grid !important;
                place-items: center !important;
                width: 38px !important;
                min-width: 38px !important;
                max-width: 38px !important;
                height: 38px !important;
                min-height: 38px !important;
                max-height: 38px !important;
                border-radius: 10px !important;
                background: #eff6ff !important;
                border: 1px solid #dbeafe !important;
                color: #2563eb !important;
                font-size: 18px !important;
                line-height: 1 !important;
                transition: none !important;
                animation: none !important;
                transform: none !important;
                box-sizing: border-box !important;
            }
            .logo-box, .logo-box * { transition: none !important; animation: none !important; }
            [onclick*="seguranca"], [onclick*="diagnostico"], [data-safety-link] { display: none !important; }
            #seguranca, #diagnostico { display: none !important; }
            @media (max-width: 900px) {
                .logo-box {
                    width: 216px !important;
                    min-height: 54px !important;
                    height: 54px !important;
                    flex-basis: 54px !important;
                    margin-bottom: 10px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function stabilizeBrand(root = document) {
        document.title = 'PLANTÃO';
        root.querySelectorAll?.('.logo-box').forEach(el => {
            const hasIcon = Boolean(el.querySelector('.fa-shield-halved'));
            const hasLabel = String(el.textContent || '').trim() === 'PLANTÃO';
            if(!hasIcon || !hasLabel) {
                el.innerHTML = '<i class="fas fa-shield-halved"></i> PLANTÃO';
            }
            el.dataset.plantaoBrandStable = 'true';
        });
        root.querySelectorAll?.('.login-card h2').forEach(el => {
            if(String(el.textContent || '').trim() !== 'PLANTÃO') el.textContent = 'PLANTÃO';
        });
    }

    function sanitizeState() {
        const data = state();
        if(!data || typeof data !== 'object') return;
        if(data.__plantaoOwner && typeof data.__plantaoOwner === 'object') delete data.__plantaoOwner.email;
        data.perfilNome = cleanText(data.perfilNome).slice(0, 80);
        (Array.isArray(data.lista) ? data.lista : []).forEach(item => {
            item.m = cleanText(item.m).slice(0, 120);
            item.a = cleanText(item.a).slice(0, 300);
        });
        Object.values(data.metaFixa || {}).forEach(tasks => {
            (Array.isArray(tasks) ? tasks : []).forEach(task => {
                task.m = cleanText(task.m).slice(0, 120);
                task.a = cleanText(task.a).slice(0, 300);
                task.l = cleanText(task.l).slice(0, 60);
            });
        });
    }

    function scrubEmails(root = document) {
        const scopes = [];
        const selector = '#ranking-content,#study-admin-panel,#perfil-content,#admin-student-banner,.admin-student-banner';
        if(root.matches?.(selector)) scopes.push(root);
        root.querySelectorAll?.(selector).forEach(scope => scopes.push(scope));
        scopes.forEach(scope => {
            scope.querySelectorAll('small').forEach(node => {
                if(hasEmail(node.textContent)) {
                    node.textContent = '';
                    node.style.display = 'none';
                }
            });
            scope.querySelectorAll('.profile-info-row').forEach(row => {
                const label = String(row.querySelector('span')?.textContent || '').trim().toLowerCase();
                if(label === 'e-mail' || hasEmail(row.textContent)) row.style.display = 'none';
            });
            scope.querySelectorAll('input, textarea').forEach(input => {
                if(hasEmail(input.value)) input.value = 'Aluno';
            });
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while(walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => {
                const parent = node.parentElement;
                if(parent && ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return;
                if(hasEmail(node.nodeValue)) node.nodeValue = displayName(node.nodeValue, parent?.closest('td') ? 'Aluno' : '');
            });
        });
    }

    function hideInternalUi(root = document) {
        const selector = '#seguranca,#diagnostico,[onclick*="seguranca"],[onclick*="diagnostico"],[data-safety-link]';
        root.querySelectorAll?.(selector).forEach(el => {
            el.classList?.remove('active');
            el.setAttribute('hidden', '');
            el.setAttribute('aria-hidden', 'true');
            el.style.display = 'none';
        });
    }

    function installPublicNames() {
        function safeStudentName(student, data, fallback = 'Aluno') {
            const options = [data?.perfilNome, student?.perfilNome, student?.name, student?.display_name, student?.full_name];
            for(const option of options) {
                const found = displayName(option, '');
                if(found) return found;
            }
            return fallback;
        }
        safeStudentName.__plantaoFinalPublicName = true;
        setFn('nomePublicoAluno', safeStudentName);

        function safeLogin() {
            const profile = value('accessProfile', null);
            const cloud = value('cloudUser', null);
            if(!cloud) return 'Acesso local';
            if(profile?.role === 'admin') return 'Administrador';
            return 'Aluno';
        }
        safeLogin.__plantaoFinalLoginLabel = true;
        setFn('loginUsuario', safeLogin);
    }

    function installAdminActions() {
        function adminRowAction(action, token) {
            const email = adminActionTargets.get(String(token || ''));
            if(!email) return undefined;
            const protectedValue = encodeURIComponent(email);
            if(action === 'edit') return fn('entrarPerfilAluno')?.(protectedValue);
            if(action === 'restore') return fn('restaurarBackupAluno')?.(protectedValue);
            if(action === 'approve') return fn('alterarAcessoAluno')?.(protectedValue, 'approved');
            if(action === 'reject') return fn('alterarAcessoAluno')?.(protectedValue, 'rejected');
            if(action === 'delete') return fn('excluirAlunoPlataforma')?.(protectedValue);
            return undefined;
        }
        adminRowAction.__plantaoFinalAdminAction = true;
        window.plantaoAdminRowAction = adminRowAction;
    }

    function installAdminList() {
        function safeList() {
            const target = document.getElementById('admin-access-list');
            if(!target) return;
            const adminEmail = String(value('ADMIN_EMAIL', ''));
            const students = (value('adminAccessList', []) || []).filter(item => String(item.email || '') !== adminEmail);
            adminActionTargets.clear();
            const revision = ++adminActionRevision;
            if(!students.length) {
                target.innerHTML = '<div class="empty-state"><strong>Nenhum aluno cadastrado.</strong></div>';
                return;
            }
            target.innerHTML = students.map((item, index) => {
                const key = `student-${revision}-${index}`;
                adminActionTargets.set(key, String(item.email || '').trim().toLowerCase());
                const name = esc(fn('nomePublicoAluno')?.(item) || 'Aluno');
                const status = item.status === 'approved' ? 'Aprovado' : (item.status === 'rejected' ? 'Recusado' : 'Pendente');
                const actions = item.status === 'approved'
                    ? `<button class="btn btn-sm btn-outline" onclick="plantaoAdminRowAction('edit', '${key}')">EDITAR PERFIL</button><button class="btn btn-sm btn-outline danger-btn" onclick="plantaoAdminRowAction('restore', '${key}')">RESTAURAR BACKUP</button><button class="btn btn-sm btn-outline danger-btn" onclick="plantaoAdminRowAction('reject', '${key}')">REVOGAR</button><button class="btn btn-sm btn-outline danger-btn" onclick="plantaoAdminRowAction('delete', '${key}')">EXCLUIR</button>`
                    : `<button class="btn btn-sm" onclick="plantaoAdminRowAction('approve', '${key}')">APROVAR</button><button class="btn btn-sm btn-outline danger-btn" onclick="plantaoAdminRowAction('reject', '${key}')">RECUSAR</button><button class="btn btn-sm btn-outline danger-btn" onclick="plantaoAdminRowAction('delete', '${key}')">EXCLUIR</button>`;
                return `<div class="admin-access-row"><div><b>${name}</b><small>${esc(item.contest || 'Concurso não informado')}</small></div><span class="access-pill ${esc(item.status || 'pending')}">${status}</span><div class="admin-access-actions">${actions}</div></div>`;
            }).join('');
        }
        safeList.__plantaoFinalAdminList = true;
        setFn('renderAdminAccessList', safeList);
        safeList();
    }

    function installStudentBanner() {
        function safeBanner() {
            const banner = document.getElementById('admin-student-banner');
            if(!banner) return;
            if(!fn('editandoAlunoComoAdmin')?.()) {
                banner.style.display = 'none';
                banner.innerHTML = '';
                return;
            }
            const context = value('adminStudentContext', {});
            banner.style.display = 'flex';
            banner.innerHTML = `<div><strong>Editando perfil de aluno</strong><span>${esc(displayName(context?.name, 'Aluno'))}</span></div>
                <button class="btn btn-sm btn-outline" onclick="voltarPerfilAdmin()"><i class="fas fa-user-shield"></i> VOLTAR PARA ADMIN</button>`;
        }
        safeBanner.__plantaoFinalStudentBanner = true;
        setFn('renderAdminStudentBanner', safeBanner);
        safeBanner();
    }

    function installPrivateAdminBackup() {
        if(fn('garantirBackupEdicaoAdmin')?.__plantaoFinalPrivateAdminBackup) return;
        let completedFor = '';
        async function privateAdminBackup(target) {
            const client = value('supabaseClient', null);
            if(!fn('editandoAlunoComoAdmin')?.() || !client || !target?.user_id || value('adminEditBackupReady', false)) return;
            const studentId = String(target.user_id);
            if(completedFor === studentId) return;
            const current = await client.from('plantao_user_data').select('data').eq('user_id', studentId).maybeSingle();
            if(current.error) throw current.error;
            const backup = await client.from('plantao_admin_backups').insert({
                student_user_id: studentId,
                before_data: JSON.parse(JSON.stringify(current.data?.data || state() || {})),
                note: 'Backup automatico antes da edicao administrativa'
            });
            if(backup.error) throw backup.error;
            completedFor = studentId;
            try { Function('adminEditBackupReady = true;')(); } catch(_) {}
        }
        privateAdminBackup.__plantaoFinalPrivateAdminBackup = true;
        setFn('garantirBackupEdicaoAdmin', privateAdminBackup);
    }

    function wrapBeforeRender(name) {
        const original = fn(name);
        if(typeof original !== 'function' || original.__plantaoFinalWrapped) return;
        function wrapped() {
            sanitizeState();
            const result = original.apply(this, arguments);
            queuePolish();
            return result;
        }
        wrapped.__plantaoFinalWrapped = true;
        wrapped.__plantaoOriginal = original;
        setFn(name, wrapped);
    }

    let polishQueued = false;
    function queuePolish() {
        if(polishQueued) return;
        polishQueued = true;
        requestAnimationFrame(() => {
            polishQueued = false;
            installFinalStyle();
            stabilizeBrand();
            hideInternalUi();
            scrubEmails();
            document.documentElement.dataset.finalSystemReview = VERSION;
        });
    }

    function install() {
        installFinalStyle();
        sanitizeState();
        installPublicNames();
        installAdminActions();
        installPrivateAdminBackup();
        installAdminList();
        installStudentBanner();
        [
            'init', 'save', 'normalizarBanco', 'showTab', 'renderPerfil', 'renderRankingAlunos',
            'renderPainelProfessor', 'renderPerformance', 'renderCiclo', 'renderFluxo',
            'renderLancamentos', 'renderInteligenciaEstudo', 'renderCadernoErros',
            'renderSimulados', 'renderBuscaGlobal', 'renderEvolucaoEstudo'
        ].forEach(wrapBeforeRender);
        queuePolish();
    }

    install();
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    const observer = new MutationObserver(queuePolish);
    if(document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('load', install, { once: true });
    [80, 300, 700, 1600, 3200].forEach(delay => setTimeout(install, delay));
})();
