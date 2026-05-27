(function plantaoFinalSystemReview() {
    if(window.__plantaoFinalSystemReview) return;
    window.__plantaoFinalSystemReview = true;

    const VERSION = 'v241-final-system-review';
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
            .stat-card,
            .study-kpi,
            .study-alert,
            .ranking-card,
            .perf-subject-group,
            .subject-flow-row,
            .lancamento-row,
            .profile-main-card,
            .profile-info-card,
            .profile-actions-card,
            .backup-card,
            .backup-summary,
            .admin-access-card,
            .admin-access-row,
            .replan-card,
            .replan-note {
                background: #ffffff !important;
                color: #0f172a !important;
                border-color: #e2e8f0 !important;
                box-shadow: 0 1px 2px rgba(15, 23, 42, .05) !important;
            }
            .stat-card h1,
            .stat-card h2,
            .stat-card h3,
            .stat-card h4,
            .stat-card b,
            .stat-card strong,
            .study-kpi strong,
            .ranking-card b,
            .perf-subject-group b,
            .subject-flow-row b,
            .lancamento-main b,
            .profile-main-card strong,
            .profile-info-card strong,
            .admin-access-row b {
                color: #0f172a !important;
                opacity: 1 !important;
            }
            .stat-card p,
            .stat-card small,
            .stat-card label,
            .study-kpi span,
            .ranking-card small,
            .perf-subject-group small,
            .subject-flow-row small,
            .lancamento-main small,
            .profile-main-card span,
            .profile-info-card span,
            .admin-access-row small {
                color: #475569 !important;
                opacity: 1 !important;
            }
            .tag,
            .badge,
            .access-pill,
            .chip,
            .mini-badge {
                color: #1e3a8a !important;
                background: #eff6ff !important;
                border-color: #bfdbfe !important;
                opacity: 1 !important;
            }
            .danger-btn,
            .tag-atrasado,
            .badge-danger {
                color: #991b1b !important;
                background: #fef2f2 !important;
                border-color: #fecaca !important;
            }
            .success,
            .tag-ex,
            .badge-success {
                color: #065f46 !important;
                background: #ecfdf5 !important;
                border-color: #a7f3d0 !important;
            }
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

    function parseRgb(color) {
        const match = String(color || '').match(/rgba?\(([^)]+)\)/i);
        if(!match) return null;
        const parts = match[1].split(',').map(part => parseFloat(part.trim()));
        if(parts.length < 3 || parts.some((value, index) => index < 3 && Number.isNaN(value))) return null;
        const alpha = parts.length >= 4 && !Number.isNaN(parts[3]) ? parts[3] : 1;
        return { r: parts[0], g: parts[1], b: parts[2], a: alpha };
    }

    function relativeLuminance({ r, g, b }) {
        const transform = value => {
            const channel = Math.max(0, Math.min(255, value)) / 255;
            return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
    }

    function contrastRatio(foreground, background) {
        const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
        const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
        return (light + 0.05) / (dark + 0.05);
    }

    function effectiveBackground(el) {
        let current = el;
        while(current && current.nodeType === 1) {
            const bg = parseRgb(getComputedStyle(current).backgroundColor);
            if(bg && bg.a > 0.05) return bg;
            current = current.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
    }

    function hasOwnReadableText(el) {
        return Array.from(el.childNodes || []).some(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0);
    }

    function fixLowContrastText(root = document) {
        const source = root.nodeType === 1 ? root : document.body;
        if(!source) return;
        const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'CANVAS', 'OPTION']);
        const nodes = source === document.body
            ? Array.from(document.body.querySelectorAll('*'))
            : [source, ...Array.from(source.querySelectorAll?.('*') || [])];
        let checked = 0;
        for(const el of nodes) {
            if(checked > 2600) break;
            if(!el || ignored.has(el.tagName) || !hasOwnReadableText(el)) continue;
            const rects = el.getClientRects?.();
            if(!rects || rects.length === 0) continue;
            checked += 1;
            const styles = getComputedStyle(el);
            const color = parseRgb(styles.color);
            if(!color || color.a < 0.25) continue;
            const bg = effectiveBackground(el);
            const ratio = contrastRatio(color, bg);
            if(ratio >= 4.2 && Number(styles.opacity || 1) >= 0.78) continue;
            const bgIsLight = relativeLuminance(bg) > 0.45;
            const isMeta = ['SMALL', 'LABEL'].includes(el.tagName) || el.className.toString().match(/meta|muted|sub|hint|desc|label/i);
            el.style.color = bgIsLight ? (isMeta ? '#475569' : '#0f172a') : '#f8fafc';
            if(Number(styles.opacity || 1) < 0.78) el.style.opacity = '1';
        }
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
            fixLowContrastText();
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
