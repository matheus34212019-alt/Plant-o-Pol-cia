(function plantaoPlatformCore() {
    if(window.__plantaoPlatformCore) return;
    window.__plantaoPlatformCore = true;

    const VERSION = 'v216-architecture';
    const WRAPPED = '__plantaoPlatformWrapped';
    const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
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
        const match = String(onclick || '').match(/showTab\(['"]([^'"]+)['"]\)/);
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
            page.setAttribute('aria-hidden', page.classList.contains('active') ? 'false' : 'true');
            if(!page.classList.contains('active')) page.setAttribute('hidden', '');
            else page.removeAttribute('hidden');
            if(!page.dataset.platformModule) page.dataset.platformModule = page.id || 'page';
        });
    }

    function syncActiveUi(id = null) {
        const activeId = id || document.querySelector('.page.active')?.id || 'diaria';
        document.querySelectorAll('.page').forEach(page => {
            const active = page.id === activeId && page.classList.contains('active');
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
        root.querySelectorAll?.(selectors.join(',')).forEach(scope => {
            scope.querySelectorAll('small').forEach(node => {
                if(EMAIL_PATTERN.test(node.textContent || '')) {
                    node.textContent = '';
                    node.style.display = 'none';
                }
                EMAIL_PATTERN.lastIndex = 0;
            });
            scope.querySelectorAll('.profile-info-row').forEach(row => {
                const label = String(row.querySelector('span')?.textContent || '').trim().toLowerCase();
                if(label === 'e-mail' || EMAIL_PATTERN.test(row.textContent || '')) row.style.display = 'none';
                EMAIL_PATTERN.lastIndex = 0;
            });
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while(walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => {
                const text = node.nodeValue || '';
                if(!EMAIL_PATTERN.test(text)) {
                    EMAIL_PATTERN.lastIndex = 0;
                    return;
                }
                node.nodeValue = text.replace(EMAIL_PATTERN, '').replace(/\s{2,}/g, ' ').trim() || 'Aluno';
                EMAIL_PATTERN.lastIndex = 0;
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
                result.finally(() => after(name, arguments));
            } else {
                after(name, arguments);
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
            'normalizarBanco'
        ].forEach(name => {
            wrapFunction(name, prepareRender, () => {
                schedulePublish(name);
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
                scrubEmails();
                enhanceButtonsAndForms();
                enhancePageShell();
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    function install() {
        installWrappers();
        enhanceCurrentSurface();
        installObservers();
        schedulePublish('install');
        window.PlantaoCore = {
            version: VERSION,
            get db() { return getDb(); },
            get metrics() { return publishState('read'); },
            refresh(reason = 'manual') { schedulePublish(reason); },
            scrubEmails,
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
