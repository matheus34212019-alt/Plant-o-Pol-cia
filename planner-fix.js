(function plannerFix() {
    const APP_NAME = 'PLANT\u00c3O';
    const STORAGE_KEY = 'prf_v120';
    const MAX_STUDY_PER_DAY = 2;

    const pad = value => String(value).padStart(2, '0');
    const cleanDate = value => {
        const date = new Date(value || new Date());
        date.setHours(0, 0, 0, 0);
        return date;
    };
    const dateKey = value => {
        const date = cleanDate(value);
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };
    const addDays = (date, amount) => {
        const next = cleanDate(date);
        next.setDate(next.getDate() + amount);
        return next;
    };
    const getDb = () => (typeof db !== 'undefined' ? db : window.db);
    const isExtraTask = task => task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    const isDone = task => task?.c === true;
    const isStudy = task => task?.k === 'E' || task?.l === 'Estudo' || !task?.k;

    const textFixes = [
        [/\bPLANT(?:AO|\u00c3O|\u00c3\u0192O|\u00c3\u0192\u00c3O|\ufffdO)\b/gi, APP_NAME],
        [/PORTUGU(?:ES|\u00caS|\u00c3\u0160S|\u00c3\u0192\u00c2\u00aaS|\ufffdS)/gi, 'PORTUGU\u00caS'],
        [/RACIOC(?:INIO|\u00cdNIO|\u00c3\u008dNIO|\ufffdNIO)\s+L(?:OGICO|\u00d3GICO|\u00c3\u201cGICO|\ufffdGICO)/gi, 'RACIOC\u00cdNIO L\u00d3GICO'],
        [/Compreens(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)/gi, 'Compreens\u00e3o'],
        [/compreens(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)/gi, 'compreens\u00e3o'],
        [/interpreta(?:cao|\u00e7\u00e3o|\u00c3\u00a7\u00c3\u00a3o|\ufffd\ufffdo)/gi, 'interpreta\u00e7\u00e3o'],
        [/Proposi(?:coes|\u00e7\u00f5es|\u00c3\u00a7\u00c3\u00b5es|\ufffd\ufffdes)/gi, 'Proposi\u00e7\u00f5es'],
        [/proposi(?:coes|\u00e7\u00f5es|\u00c3\u00a7\u00c3\u00b5es|\ufffd\ufffdes)/gi, 'proposi\u00e7\u00f5es'],
        [/Conectivos/gi, 'conectivos'],
        [/mat(?:erias|\u00e9rias|\u00c3\u00a9rias|\ufffdrias)/gi, 'mat\u00e9rias'],
        [/Mat(?:erias|\u00e9rias|\u00c3\u00a9rias|\ufffdrias)/g, 'Mat\u00e9rias'],
        [/mat(?:eria|\u00e9ria|\u00c3\u00a9ria|\ufffdria)/gi, 'mat\u00e9ria'],
        [/Mat(?:eria|\u00e9ria|\u00c3\u00a9ria|\ufffdria)/g, 'Mat\u00e9ria'],
        [/Revis(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)/gi, 'Revis\u00e3o'],
        [/revis(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)/gi, 'revis\u00e3o'],
        [/Quest(?:oes|\u00f5es|\u00c3\u00b5es|\ufffdes)/gi, 'Quest\u00f5es'],
        [/quest(?:oes|\u00f5es|\u00c3\u00b5es|\ufffdes)/gi, 'quest\u00f5es'],
        [/Exerc(?:icios|\u00edcios|\u00c3\u00adcios|\ufffdcios)/gi, 'Exerc\u00edcios'],
        [/exerc(?:icios|\u00edcios|\u00c3\u00adcios|\ufffdcios)/gi, 'exerc\u00edcios'],
        [/Lan(?:camentos|\u00e7amentos|\u00c3\u00a7amentos|\ufffdamentos)/gi, 'Lan\u00e7amentos'],
        [/lan(?:camentos|\u00e7amentos|\u00c3\u00a7amentos|\ufffdamentos)/gi, 'lan\u00e7amentos'],
        [/Hor(?:arios|\u00e1rios|\u00c3\u00a1rios|\ufffdrios)/gi, 'Hor\u00e1rios'],
        [/hor(?:arios|\u00e1rios|\u00c3\u00a1rios|\ufffdrios)/gi, 'hor\u00e1rios'],
        [/Di(?:arias|\u00e1rias|\u00c3\u00a1rias|\ufffdrias)/gi, 'Di\u00e1rias'],
        [/di(?:arias|\u00e1rias|\u00c3\u00a1rias|\ufffdrias)/gi, 'di\u00e1rias'],
        [/Amanh(?:a|\u00e3|\u00c3\u00a3|\ufffd)/gi, 'Amanh\u00e3'],
        [/amanh(?:a|\u00e3|\u00c3\u00a3|\ufffd)/gi, 'amanh\u00e3'],
        [/Voc(?:e|\u00ea|\u00c3\u00aa|\ufffd)/gi, 'Voc\u00ea'],
        [/voc(?:e|\u00ea|\u00c3\u00aa|\ufffd)/gi, 'voc\u00ea'],
        [/Precis(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)/gi, 'Precis\u00e3o'],
        [/precis(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)/gi, 'precis\u00e3o'],
        [/Persegui(?:cao|\u00e7\u00e3o|\u00c3\u00a7\u00c3\u00a3o|\ufffd\ufffdo)/gi, 'Persegui\u00e7\u00e3o'],
        [/Miss(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)/gi, 'Miss\u00e3o'],
        [/miss(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)/gi, 'miss\u00e3o'],
        [/Sequ(?:encia|\u00eancia|\u00c3\u00aancia|\ufffdncia)/gi, 'Sequ\u00eancia'],
        [/sequ(?:encia|\u00eancia|\u00c3\u00aancia|\ufffdncia)/gi, 'sequ\u00eancia'],
        [/conclu(?:idas|\u00eddas|\u00c3\u00addas|\ufffddas)/gi, 'conclu\u00eddas'],
        [/j(?:a|\u00e1|\u00c3\u00a1|\ufffd)\s+dominados/gi, 'j\u00e1 dominados'],
        [/recome(?:ca|\u00e7a|\u00c3\u00a7a|\ufffda)/gi, 'recome\u00e7a'],
        [/Pr(?:oximos|\u00f3ximos|\u00c3\u00b3ximos|\ufffdximos)/gi, 'Pr\u00f3ximos'],
        [/pr(?:oximos|\u00f3ximos|\u00c3\u00b3ximos|\ufffdximos)/gi, 'pr\u00f3ximos'],
        [/P(?:ublica|\u00fablica|\u00c3\u00bablica|\ufffdblica)/gi, 'P\u00fablica'],
        [/p(?:ublica|\u00fablica|\u00c3\u00bablica|\ufffdblica)/gi, 'p\u00fablica'],
        [/Administra(?:cao|\u00e7\u00e3o|\u00c3\u00a7\u00c3\u00a3o|\ufffd\ufffdo)/gi, 'Administra\u00e7\u00e3o'],
        [/\bN(?:AO|\u00c3O|\u00c3\u0192O|\ufffdO)\b/g, 'N\u00c3O'],
        [/\bn(?:ao|\u00e3o|\u00c3\u00a3o|\ufffdo)\b/g, 'n\u00e3o'],
        [/For(?:ca|\u00e7a|\u00c3\u00a7a|\ufffda)/gi, 'For\u00e7a'],
        [/\bFOR(?:CA|\u00c7A|\u00c3\u2021A|\ufffdA)\b/g, 'FOR\u00c7A']
    ];

    function decodeMojibake(value) {
        if (typeof value !== 'string') return value;
        let text = value;
        for (let i = 0; i < 2; i++) {
            if (!/[\u00c2\u00c3\ufffd]/.test(text)) break;
            try {
                const decoded = decodeURIComponent(escape(text));
                if (decoded && decoded !== text) text = decoded;
            } catch (error) {
                break;
            }
        }
        return text;
    }

    function fixText(value) {
        if (typeof value !== 'string') return value;
        let text = decodeMojibake(value);
        textFixes.forEach(([pattern, replacement]) => {
            text = text.replace(pattern, replacement);
        });
        return text;
    }

    function fixAttributes(root = document.body) {
        if (!root?.querySelectorAll) return;
        root.querySelectorAll('[placeholder], [title], [aria-label], input[value], option').forEach(element => {
            ['placeholder', 'title', 'aria-label'].forEach(attr => {
                if (!element.hasAttribute(attr)) return;
                const fixed = fixText(element.getAttribute(attr));
                if (fixed !== element.getAttribute(attr)) element.setAttribute(attr, fixed);
            });
            if (element.tagName === 'OPTION') {
                const fixed = fixText(element.textContent);
                if (fixed !== element.textContent) element.textContent = fixed;
            }
        });
    }

    function fixVisibleText(root = document.body) {
        if (!root) return;
        document.title = APP_NAME;
        document.querySelectorAll('.logo-box').forEach(element => {
            if (element.textContent.trim() !== APP_NAME) {
                const icon = element.querySelector('i')?.outerHTML || '<i class="fas fa-shield-halved"></i>';
                element.innerHTML = `${icon} ${APP_NAME}`;
            }
        });
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const fixed = fixText(node.nodeValue);
            if (fixed !== node.nodeValue) node.nodeValue = fixed;
        });
        fixAttributes(root);
    }

    function fixObjectText(value, seen = new WeakSet()) {
        if (!value || typeof value !== 'object') return value;
        if (seen.has(value)) return value;
        seen.add(value);
        Object.keys(value).forEach(key => {
            if (typeof value[key] === 'string') value[key] = fixText(value[key]);
            else if (value[key] && typeof value[key] === 'object') fixObjectText(value[key], seen);
        });
        return value;
    }

    function normalizeDataText() {
        const data = getDb();
        if (!data) return;
        fixObjectText(data);
    }

    function taskHours(task) {
        if (typeof task?.h === 'number') return Math.max(0.5, task.h || 1);
        if (task?.h && typeof task.h === 'object') return Math.max(0.5, parseFloat(task.h[task.k] || task.h.E || 1));
        return Math.max(0.5, parseFloat(task?.h) || 1);
    }

    function dayCapacity(date) {
        const data = getDb();
        return Math.max(0, parseFloat(data?.h?.[cleanDate(date).getDay()]) || 0);
    }

    function dayUsage(tasks) {
        return (tasks || [])
            .filter(task => !isExtraTask(task))
            .reduce((total, task) => total + taskHours(task), 0);
    }

    function studyCount(tasks) {
        return (tasks || []).filter(task => !isExtraTask(task) && isStudy(task)).length;
    }

    function taskId(task) {
        return [
            task?.id || '',
            task?.m || '',
            task?.a || '',
            task?.k || '',
            task?.l || '',
            task?.origemAtraso || ''
        ].join('|').toLowerCase();
    }

    function normalizeTask(task, origem) {
        return {
            ...task,
            c: false,
            atraso: false,
            replanejado: false,
            origemAtraso: task?.origemAtraso || origem,
            l: task?.l === 'Extra' ? task.l : (task?.l || 'Estudo'),
            k: task?.k || 'E'
        };
    }

    function canFit(tasks, date, task) {
        if (isExtraTask(task) || isDone(task)) return true;
        const capacity = dayCapacity(date);
        if (capacity <= 0) return false;
        if (dayUsage(tasks) + taskHours(task) > capacity) return false;
        if (isStudy(task) && studyCount(tasks) >= MAX_STUDY_PER_DAY) return false;
        return true;
    }

    function placeTask(task, startDate) {
        const data = getDb();
        for (let offset = 1; offset <= 365; offset++) {
            const targetDate = addDays(startDate, offset);
            const key = dateKey(targetDate);
            const tasks = data.metaFixa[key] || [];
            if (canFit(tasks, targetDate, task)) {
                data.metaFixa[key] = tasks.concat(task);
                return key;
            }
        }

        const fallbackKey = dateKey(addDays(startDate, 1));
        data.metaFixa[fallbackKey] = (data.metaFixa[fallbackKey] || []).concat(task);
        return fallbackKey;
    }

    function saveNow() {
        const data = getDb();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {}
        if (typeof save === 'function') save();
    }

    function getAtrasosAteHoje(today = new Date()) {
        const data = getDb();
        const todayKey = dateKey(today);
        const atrasos = [];
        Object.keys(data?.metaFixa || {}).sort().forEach(key => {
            if (key > todayKey) return;
            (data.metaFixa[key] || []).forEach(task => {
                if (!isExtraTask(task) && !isDone(task)) atrasos.push({ dia: key, task });
            });
        });
        return atrasos;
    }

    function encaixarAtrasosNoCronograma(atrasos, inicioDate) {
        const seen = new Set();
        atrasos
            .map(({ dia, task }) => normalizeTask(task, dia))
            .filter(task => {
                const id = taskId(task);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            })
            .forEach(task => placeTask(task, inicioDate));
    }

    function refresh(today) {
        if (typeof vDate !== 'undefined') vDate = new Date(today);
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderReplanejar === 'function') renderReplanejar();
        setTimeout(() => fixVisibleText(), 0);
    }

    function replanejarAgoraCorrigido() {
        const data = getDb();
        if (!data) return;
        data.metaFixa = data.metaFixa || {};

        const today = cleanDate(new Date());
        const atrasos = getAtrasosAteHoje(today);
        if (!atrasos.length) {
            if (typeof showToast === 'function') showToast('Sem atrasos', 'Nenhuma pend\u00eancia encontrada para replanejar.');
            return;
        }

        const porDia = atrasos.reduce((map, item) => {
            if (!map[item.dia]) map[item.dia] = new Set();
            map[item.dia].add(item.task);
            return map;
        }, {});

        Object.keys(porDia).forEach(key => {
            data.metaFixa[key] = (data.metaFixa[key] || []).filter(task => !porDia[key].has(task));
            if (!data.metaFixa[key].length) delete data.metaFixa[key];
        });

        encaixarAtrasosNoCronograma(atrasos, today);
        normalizeDataText();
        saveNow();
        refresh(today);

        if (typeof showToast === 'function') {
            showToast('Plant\u00e3o replanejado', 'Os atrasos foram redistribu\u00eddos respeitando as horas di\u00e1rias.');
        }
    }

    function wrapRender(name) {
        if (typeof window[name] !== 'function' || window[name].__plantaoTextFixWrapped) return;
        const original = window[name];
        window[name] = function wrappedRender(...args) {
            const result = original.apply(this, args);
            setTimeout(() => fixVisibleText(), 0);
            return result;
        };
        window[name].__plantaoTextFixWrapped = true;
    }

    function boot() {
        window.getAtrasosAteHoje = getAtrasosAteHoje;
        window.encaixarAtrasosNoCronograma = encaixarAtrasosNoCronograma;
        window.replanejarAgora = replanejarAgoraCorrigido;
        normalizeDataText();
        saveNow();
        ['renderDiario', 'renderSemanal', 'updateDashboard', 'renderTree', 'renderFluxo', 'renderCiclo', 'renderReplanejar', 'renderRankingAlunos', 'renderPerfil'].forEach(wrapRender);
        fixVisibleText();
        setTimeout(fixVisibleText, 500);
        setTimeout(fixVisibleText, 1500);
        new MutationObserver(() => fixVisibleText()).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
