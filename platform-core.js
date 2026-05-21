(function plantaoPlatformCore() {
    if(window.__plantaoPlatformCore) return;
    window.__plantaoPlatformCore = true;

    const VERSION = 'v217-stability';
    const WRAPPED = '__plantaoPlatformWrapped';
    const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const MOJIBAKE_SEQUENCE = /[\u00c2-\u00c3][\u0080-\u00bf]/;
    const PRIVATE_PAGE_IDS = new Set(['seguranca', 'diagnostico']);
    const MAIN_PAGE_IDS = [
        'diaria',
        'semanal',
        'performance',
        'ranking',
        'perfil',
        'edital',
        'ciclo',
        'config-h',
        'sinalizar',
        'fluxo',
        'replanejar',
        'lancamentos',
        'inteligencia',
        'caderno-erros',
        'simulados',
        'busca-global',
        'evolucao'
    ];

    let publishPending = false;
    let enhancePending = false;
    let lastFingerprint = '';
    let lastMetrics = null;

    function containsEmail(value) {
        EMAIL_PATTERN.lastIndex = 0;
        const found = EMAIL_PATTERN.test(String(value || ''));
        EMAIL_PATTERN.lastIndex = 0;
        return found;
    }

    function removeEmails(value, fallback = 'Aluno') {
        EMAIL_PATTERN.lastIndex = 0;
        const cleaned = String(value || '')
            .replace(EMAIL_PATTERN, '')
            .replace(/\s+\|\s*$/, '')
            .replace(/^\s+\|\s*/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        EMAIL_PATTERN.lastIndex = 0;
        return cleaned || fallback;
    }

    function privacyText(value, fallback = '') {
        return containsEmail(value) ? removeEmails(value, fallback) : value;
    }

    function decodeLatin1Utf8(value) {
        const text = String(value || '').replace(/\u00c3\u0192/g, '\u00c3');
        if(!MOJIBAKE_SEQUENCE.test(text)) return text;
        try {
            const bytes = Uint8Array.from(Array.from(text, ch => ch.charCodeAt(0) & 255));
            const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
            return decoded && !decoded.includes('\ufffd') ? decoded : text;
        } catch(_) {
            try {
                return decodeURIComponent(escape(text));
            } catch(__) {
                return text;
            }
        }
    }

    function normalizeTextValue(value) {
        if(typeof value !== 'string' || !value) return value;
        return decodeLatin1Utf8(value)
            .replace(/PLANT\u00c3\u0192O/g, 'PLANT\u00c3O')
            .replace(/AMANH\u00c3\u0192/g, 'AMANH\u00c3')
            .replace(/\bNAO\b/g, 'N\u00c3O');
    }

    function globalValue(name) {
        try { return Function(`return typeof ${name} === "undefined" ? null : ${name};`)(); }
        catch(_) { return window[name] || null; }
    }

    function setGlobal(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function getDb() {
        const db = globalValue('db');
        return db && typeof db === 'object' ? db : null;
    }

    function call(name, args = []) {
        const fn = globalValue(name);
        if(typeof fn !== 'function') return null;
        return fn.apply(window, args);
    }

    function idle(fn) {
        if('requestIdleCallback' in window) return requestIdleCallback(fn, { timeout: 800 });
        return setTimeout(fn, 16);
    }

    function raf(fn) {
        return requestAnimationFrame(fn);
    }

    function number(value) {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : 0;
    }

    function integer(value) {
        const n = parseInt(value, 10);
        return Number.isFinite(n) ? n : 0;
    }

    function isExtra(task) {
        const original = globalValue('isExtraTask');
        if(typeof original === 'function') {
            try { return original(task); } catch(_) {}
        }
        return task?.extra === true || task?.l === 'Extra';
    }

    function dateKey(date) {
        const fn = globalValue('dateKey');
        if(typeof fn === 'function') {
            try { return fn(date); } catch(_) {}
        }
        return new Date(date).toLocaleDateString('pt-BR');
    }

    function keyToDate(key) {
        const fn = globalValue('keyToDate');
        if(typeof fn === 'function') {
            try { return fn(key); } catch(_) {}
        }
        const parts = String(key || '').split('/').map(Number);
        if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        return new Date(key);
    }

    function weekStart(date = new Date()) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

    function tasksForWeek(db) {
        const start = weekStart();
        const out = [];
        for(let i = 0; i < 7; i += 1) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = dateKey(d);
            (db?.metaFixa?.[key] || []).forEach(task => {
                if(!isExtra(task)) out.push({ day: key, task });
            });
        }
        return out;
    }

    function stateFingerprint(db = getDb()) {
        if(!db) return 'empty';
        const metaKeys = Object.keys(db.metaFixa || {});
        let completed = 0;
        let planned = 0;
        metaKeys.forEach(key => {
            (db.metaFixa[key] || []).forEach(task => {
                if(isExtra(task)) return;
                planned += 1;
                if(task.c) completed += 1;
            });
        });
        return [
            db.lista?.length || 0,
            db.ciclo?.join('|') || '',
            metaKeys.length,
            planned,
            completed,
            db.lancamentos?.length || 0,
            db.tempoLiquido?.length || 0,
            db.diasPausados?.length || 0
        ].join(':');
    }

    function computeMetrics(db = getDb()) {
        ensureCoreShapes(db);
        const weekTasks = tasksForWeek(db);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const todayKey = dateKey(now);
        const todayTasks = (db?.metaFixa?.[todayKey] || []).filter(task => !isExtra(task));
        const totalSubjects = db?.lista?.length || 0;
        const completedSubjects = (db?.lista || []).filter(item => item.f || item.done?.Ex).length;
        const activeSubjects = new Set(db?.ciclo || []).size;
        const weekPlannedHours = weekTasks.reduce((acc, row) => acc + number(row.task.h), 0);
        const weekDoneHours = weekTasks.filter(row => row.task.c).reduce((acc, row) => acc + number(row.task.h), 0);
        const todayPlannedHours = todayTasks.reduce((acc, task) => acc + number(task.h), 0);
        const todayDoneHours = todayTasks.filter(task => task.c).reduce((acc, task) => acc + number(task.h), 0);
        let questions = 0;
        let hits = 0;
        let overdue = 0;
        Object.entries(db?.metaFixa || {}).forEach(([key, tasks]) => {
            const day = keyToDate(key);
            (tasks || []).forEach(task => {
                if(isExtra(task)) return;
                if(task.perf) {
                    questions += integer(task.perf.t);
                    hits += integer(task.perf.a);
                }
                if(!task.c && day < now) overdue += 1;
            });
        });
        const liquidSeconds = Array.isArray(db?.tempoLiquido)
            ? db.tempoLiquido.reduce((acc, row) => acc + Math.max(0, number(row.segundos)), 0)
            : 0;
        return {
            version: VERSION,
            activePage: document.querySelector('.page.active')?.id || 'diaria',
            totalSubjects,
            completedSubjects,
            activeSubjects,
            weekPlannedHours,
            weekDoneHours,
            todayPlannedHours,
            todayDoneHours,
            precision: questions ? Math.round((hits / questions) * 100) : 0,
            questions,
            overdue,
            liquidHours: liquidSeconds / 3600,
            progress: weekPlannedHours ? Math.round((weekDoneHours / weekPlannedHours) * 100) : 0
        };
    }

    function ensureCoreShapes(db = getDb()) {
        if(!db || typeof db !== 'object') return null;
        if(!Array.isArray(db.lista)) db.lista = [];
        if(!Array.isArray(db.ciclo)) db.ciclo = [];
        if(!Array.isArray(db.lancamentos)) db.lancamentos = [];
        if(!Array.isArray(db.tempoLiquido)) db.tempoLiquido = [];
        if(!Array.isArray(db.diasPausados)) db.diasPausados = [];
        if(!db.metaFixa || typeof db.metaFixa !== 'object' || Array.isArray(db.metaFixa)) db.metaFixa = {};
        if(!db.planosTravados || typeof db.planosTravados !== 'object' || Array.isArray(db.planosTravados)) db.planosTravados = {};
        if(!db.h || typeof db.h !== 'object' || Array.isArray(db.h)) db.h = {};
        for(let i = 0; i < 7; i += 1) db.h[i] = Math.max(0, number(db.h[i]));
        Object.keys(db.metaFixa).forEach(key => {
            if(!Array.isArray(db.metaFixa[key])) db.metaFixa[key] = [];
        });
        return db;
    }

    function prepareRender(name, args) {
        if((name === 'showToast' || name === 'setCloudStatus' || name === 'confirmarAcaoPlano') && args?.length) {
            for(let i = 0; i < args.length; i += 1) {
                if(typeof args[i] === 'string') args[i] = privacyText(args[i], i === 0 ? 'Aviso' : 'Atualizado.');
            }
        }
        const db = ensureCoreShapes();
        if(!db) return;
        if(name === 'renderDiario' || name === 'renderDiarioSemRecalcular') {
            const viewDate = args?.[0] instanceof Date ? args[0] : globalValue('vDate') || new Date();
            const key = dateKey(viewDate);
            if(key && !Array.isArray(db.metaFixa[key])) db.metaFixa[key] = [];
        }
        if(name === 'renderSemanal') {
            const start = weekStart(globalValue('vDate') || new Date());
            for(let i = 0; i < 7; i += 1) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const key = dateKey(d);
                if(key && !Array.isArray(db.metaFixa[key])) db.metaFixa[key] = [];
            }
        }
    }

    function publishState(reason = 'refresh') {
        const db = getDb();
        const fingerprint = stateFingerprint(db);
        if(fingerprint === lastFingerprint && lastMetrics) return lastMetrics;
        lastFingerprint = fingerprint;
        lastMetrics = computeMetrics(db);
        window.PlantaoCoreState = {
            reason,
            version: VERSION,
            at: new Date().toISOString(),
            metrics: lastMetrics
        };
        document.documentElement.dataset.plantaoCore = VERSION;
        window.dispatchEvent(new CustomEvent('plantao:state', { detail: window.PlantaoCoreState }));
        return lastMetrics;
    }

    function schedulePublish(reason) {
        if(publishPending) return;
        publishPending = true;
        raf(() => {
            publishPending = false;
            publishState(reason);
            enhanceCurrentSurface();
        });
    }

    function parseTabId(onclick) {
        const match = String(onclick || '').match(/showTab\(['"]([^'"]+)['"]/);
        return match ? match[1] : '';
    }

    function enhanceNavigation() {
        const sidebar = document.querySelector('.sidebar');
        if(sidebar) sidebar.setAttribute('role', 'tablist');
        document.querySelectorAll('.nav-item, .sub-link').forEach(el => {
            const id = parseTabId(el.getAttribute('onclick'));
            if(!id) return;
            el.dataset.tabTarget = id;
            el.setAttribute('role', 'tab');
            el.setAttribute('tabindex', el.classList.contains('active') ? '0' : '-1');
            el.setAttribute('aria-controls', id);
            el.setAttribute('aria-selected', el.classList.contains('active') ? 'true' : 'false');
            if(PRIVATE_PAGE_IDS.has(id)) {
                el.setAttribute('aria-hidden', 'true');
                el.style.display = 'none';
            }
            if(el.__plantaoKeyboardReady) return;
            el.__plantaoKeyboardReady = true;
            el.addEventListener('keydown', event => {
                if(event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                el.click();
            });
        });
    }

    function enhancePages() {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.add('platform-page');
            page.setAttribute('role', 'tabpanel');
            if(PRIVATE_PAGE_IDS.has(page.id)) {
                page.classList.remove('active');
                page.setAttribute('aria-hidden', 'true');
                page.setAttribute('hidden', '');
                return;
            }
            page.setAttribute('aria-hidden', page.classList.contains('active') ? 'false' : 'true');
            if(!page.classList.contains('active')) page.setAttribute('hidden', '');
            else page.removeAttribute('hidden');
            if(!page.dataset.platformModule) page.dataset.platformModule = page.id || 'page';
        });
    }

    function syncActiveUi(id = null) {
        const requestedId = id || document.querySelector('.page.active')?.id || 'diaria';
        const activeId = PRIVATE_PAGE_IDS.has(requestedId) ? 'diaria' : requestedId;
        document.querySelectorAll('.page').forEach(page => {
            if(PRIVATE_PAGE_IDS.has(page.id)) {
                page.classList.remove('active');
                page.toggleAttribute('hidden', true);
                page.setAttribute('aria-hidden', 'true');
                return;
            }
            const active = page.id === activeId && (id || page.classList.contains('active'));
            if(active) page.classList.add('active');
            page.toggleAttribute('hidden', !active);
            page.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
        document.querySelectorAll('[data-tab-target]').forEach(tab => {
            const selected = tab.dataset.tabTarget === activeId;
            tab.setAttribute('aria-selected', selected ? 'true' : 'false');
            tab.setAttribute('tabindex', selected ? '0' : '-1');
        });
        document.documentElement.dataset.activeTab = activeId;
    }

    function scrubEmails(root = document) {
        const selectors = [
            '#ranking-content',
            '#study-admin-panel',
            '#perfil-content',
            '#admin-student-banner',
            '.admin-student-banner'
        ];
        const scopeSelector = selectors.join(',');
        const scopes = [];
        if(root.matches?.(scopeSelector)) scopes.push(root);
        root.querySelectorAll?.(scopeSelector).forEach(scope => scopes.push(scope));
        scopes.forEach(scope => {
            scope.querySelectorAll('small').forEach(node => {
                if(containsEmail(node.textContent)) {
                    node.textContent = '';
                    node.style.display = 'none';
                }
            });
            scope.querySelectorAll('.profile-info-row').forEach(row => {
                const label = String(row.querySelector('span')?.textContent || '').trim().toLowerCase();
                if(label === 'e-mail' || containsEmail(row.textContent)) row.style.display = 'none';
            });
            scope.querySelectorAll('input, textarea').forEach(input => {
                if(containsEmail(input.value)) input.value = 'Aluno';
            });
            scope.querySelectorAll('b,strong,span,td,div,p,h3').forEach(node => {
                if(node.children.length || !containsEmail(node.textContent)) return;
                node.textContent = removeEmails(node.textContent, node.closest('td') ? 'Aluno' : '');
            });
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while(walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => {
                const parent = node.parentElement;
                if(parent && ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return;
                const text = node.nodeValue || '';
                if(!containsEmail(text)) return;
                node.nodeValue = removeEmails(text, parent?.closest('td') ? 'Aluno' : '');
            });
        });
    }

    function isAdminUser() {
        const admin = globalValue('usuarioAdmin');
        if(typeof admin === 'function') {
            try { return Boolean(admin()); } catch(_) {}
        }
        return false;
    }

    function cleanupInternalUi(root = document) {
        const internalSelector = [
            '#seguranca',
            '#diagnostico',
            '[onclick*="seguranca"]',
            '[onclick*="diagnostico"]'
        ].join(',');
        root.querySelectorAll?.(internalSelector).forEach(el => {
            if(el.id === 'seguranca' || el.id === 'diagnostico') {
                el.classList.remove('active');
                el.setAttribute('hidden', '');
                el.setAttribute('aria-hidden', 'true');
                return;
            }
            if(!isAdminUser()) {
                const card = el.closest('.profile-actions-card, .stat-card');
                if(card) {
                    card.style.display = 'none';
                    card.setAttribute('aria-hidden', 'true');
                } else {
                    el.style.display = 'none';
                    el.setAttribute('aria-hidden', 'true');
                }
            }
        });
    }

    function applyBrandText(root = document) {
        document.title = 'PLANT\u00c3O';
        root.querySelectorAll?.('.logo-box').forEach(el => {
            el.innerHTML = '<i class="fas fa-shield-halved"></i> PLANT\u00c3O';
        });
        root.querySelectorAll?.('.login-card h2').forEach(el => {
            el.textContent = 'PLANT\u00c3O';
        });
    }

    function normalizeVisibleTexts(root = document) {
        applyBrandText(root);
        const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while(walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const parent = node.parentElement;
            if(parent && ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return;
            const fixed = normalizeTextValue(node.nodeValue || '');
            if(fixed !== node.nodeValue) node.nodeValue = fixed;
        });
        root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(el => {
            ['placeholder', 'title', 'aria-label'].forEach(attr => {
                if(!el.hasAttribute(attr)) return;
                const fixed = normalizeTextValue(el.getAttribute(attr));
                if(fixed !== el.getAttribute(attr)) el.setAttribute(attr, fixed);
            });
        });
    }

    function enhanceButtonsAndForms(root = document) {
        root.querySelectorAll('button, [role="button"], .btn').forEach(btn => {
            if(!btn.getAttribute('aria-label') && !String(btn.textContent || '').trim()) {
                btn.setAttribute('aria-label', 'Acao');
            }
        });
        root.querySelectorAll('input, textarea, select').forEach(control => {
            if(control.id && !control.getAttribute('aria-describedby')) {
                const label = root.querySelector(`label[for="${CSS.escape(control.id)}"]`);
                if(label) control.setAttribute('aria-label', label.textContent.trim());
            }
        });
    }

    function enhancePageShell(root = document) {
        root.querySelectorAll('.page-header').forEach(header => header.classList.add('platform-page-header'));
        root.querySelectorAll('.stat-card').forEach(card => card.classList.add('platform-card'));
        root.querySelectorAll('.empty-state').forEach(empty => empty.setAttribute('role', 'status'));
    }

    function enhanceCurrentSurface() {
        if(enhancePending) return;
        enhancePending = true;
        idle(() => {
            enhancePending = false;
            enhanceNavigation();
            enhancePages();
            syncActiveUi();
            normalizeVisibleTexts();
            cleanupInternalUi();
            scrubEmails();
            enhanceButtonsAndForms();
            enhancePageShell();
        });
    }

    function wrapFunction(name, before, after) {
        const original = globalValue(name);
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function wrapped() {
            if(before) before(name, arguments);
            const result = original.apply(this, arguments);
            if(result && typeof result.finally === 'function') {
                result.finally(() => {
                    if(after) after(name, arguments);
                });
            } else {
                if(after) after(name, arguments);
            }
            return result;
        }
        wrapped[WRAPPED] = true;
        wrapped.__plantaoOriginal = original;
        setGlobal(name, wrapped);
        return true;
    }

    function wrapDashboard() {
        const original = globalValue('updateDashboard');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        let pending = false;
        let lastThis = null;
        let lastArgs = null;
        function wrappedDashboard() {
            lastThis = this;
            lastArgs = arguments;
            if(pending) return undefined;
            pending = true;
            raf(() => {
                pending = false;
                original.apply(lastThis, lastArgs);
                schedulePublish('dashboard');
            });
            return undefined;
        }
        wrappedDashboard[WRAPPED] = true;
        wrappedDashboard.__plantaoOriginal = original;
        setGlobal('updateDashboard', wrappedDashboard);
        return true;
    }

    function installWrappers() {
        [
            'showTab',
            'init',
            'renderDiario',
            'renderDiarioSemRecalcular',
            'renderSemanal',
            'renderPerformance',
            'renderPerfil',
            'renderRankingAlunos',
            'renderCiclo',
            'renderHInputs',
            'renderTree',
            'renderFluxo',
            'renderReplanejamento',
            'renderLancamentos',
            'renderInteligenciaEstudo',
            'renderCadernoErros',
            'renderSimulados',
            'renderBuscaGlobal',
            'renderEvolucaoEstudo',
            'renderPainelProfessor',
            'save',
            'normalizarBanco',
            'showToast',
            'setCloudStatus',
            'confirmarAcaoPlano'
        ].forEach(name => {
            wrapFunction(name, prepareRender, (fnName, args) => {
                if(fnName === 'showTab' && typeof args?.[0] === 'string') syncActiveUi(args[0]);
                schedulePublish(fnName);
                enhanceCurrentSurface();
            });
        });
        wrapDashboard();
    }

    function installObservers() {
        if(window.__plantaoPlatformObserver) return;
        window.__plantaoPlatformObserver = true;
        let pending = false;
        new MutationObserver(() => {
            if(pending) return;
            pending = true;
            raf(() => {
                pending = false;
                normalizeVisibleTexts();
                cleanupInternalUi();
                scrubEmails();
                enhanceButtonsAndForms();
                enhancePageShell();
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    function installTextNormalization() {
        if(window.__plantaoTextNormalization) return;
        window.__plantaoTextNormalization = true;
        [0, 80, 250, 700, 1500, 3000].forEach(delay => {
            setTimeout(() => {
                normalizeVisibleTexts();
                cleanupInternalUi();
                scrubEmails();
            }, delay);
        });
        window.addEventListener('load', () => {
            normalizeVisibleTexts();
            cleanupInternalUi();
            scrubEmails();
        }, { once: true });
    }

    function install() {
        installWrappers();
        enhanceCurrentSurface();
        installObservers();
        installTextNormalization();
        schedulePublish('install');
        window.PlantaoCore = {
            version: VERSION,
            get db() { return getDb(); },
            get metrics() { return publishState('read'); },
            refresh(reason = 'manual') { schedulePublish(reason); },
            scrubEmails,
            normalizeVisibleTexts,
            cleanupInternalUi,
            enhance: enhanceCurrentSurface
        };
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }

    let tries = 0;
    const retry = setInterval(() => {
        tries += 1;
        installWrappers();
        enhanceCurrentSurface();
        if(tries > 40) clearInterval(retry);
    }, 250);
})();
