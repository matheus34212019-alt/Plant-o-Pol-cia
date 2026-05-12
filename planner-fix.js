(function plannerFix() {
    const APP_NAME = 'PLANT\u00c3O';
    const STORAGE_KEY = 'prf_v120';
    const MAX_STUDY_PER_DAY = 2;
    const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

    const pad = n => String(n).padStart(2, '0');
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

    const CP1252_BYTES = {
        0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
        0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
        0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
        0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
        0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
        0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
    };

    function badScore(value) {
        return (String(value).match(/[\u00c3\u00c2\ufffd]|\u00ef\u00bf\u00bd|\u00e2[\u0080-\u00bf]/g) || []).length;
    }

    function byteCp1252(char) {
        const code = char.codePointAt(0);
        if (code <= 0xff) return code;
        return CP1252_BYTES[code] ?? null;
    }

    function decodeMojibakeOnce(value) {
        const bytes = [];
        for (const char of value) {
            const byte = byteCp1252(char);
            if (byte === null) return value;
            bytes.push(byte);
        }
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }

    function fixText(value) {
        if (typeof value !== 'string') return value;
        let text = value;
        for (let index = 0; index < 5; index += 1) {
            const decoded = decodeMojibakeOnce(text);
            if (decoded === text || badScore(decoded) > badScore(text)) break;
            text = decoded;
            if (badScore(text) === 0) break;
        }
        return text
            .replace(/PLANT(?:AO|\u00c3O|[\u00c0-\u017f\ufffd]+O)/gi, APP_NAME)
            .replace(/Voc\ufffd/g, 'VocÃª')
            .replace(/n\ufffdo/g, 'nÃ£o')
            .replace(/N\ufffdo/g, 'NÃ£o')
            .replace(/Miss\ufffdo/g, 'MissÃ£o')
            .replace(/Quest\ufffdes/g, 'QuestÃµes')
            .replace(/Precis\ufffdo/g, 'PrecisÃ£o')
            .replace(/Revis\ufffdo/g, 'RevisÃ£o')
            .replace(/Exerc\ufffdcios/g, 'ExercÃ­cios')
            .replace(/Mat\ufffdrias/g, 'MatÃ©rias')
            .replace(/Publica\ufffdo/g, 'PublicaÃ§Ã£o')
            .replace(/solicita\ufffdes/g, 'solicitaÃ§Ãµes')
            .replace(/lan\ufffamentos/g, 'lanÃ§amentos')
            .replace(/Hor\ufffarios/g, 'HorÃ¡rios')
            .replace(/Di\ufffarias/g, 'DiÃ¡rias');
    }

    function fixAttributes(root) {
        root.querySelectorAll?.('[placeholder], [title], [aria-label], [data-label]').forEach((el) => {
            ['placeholder', 'title', 'aria-label', 'data-label'].forEach((attr) => {
                const original = el.getAttribute(attr);
                if (!original) return;
                const fixed = fixText(original);
                if (fixed !== original) el.setAttribute(attr, fixed);
            });
        });
    }

    function hideRankingEmails(root) {
        root.querySelectorAll?.('.ranking-card, #ranking-content, #ranking').forEach((el) => {
            el.childNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE && /@/.test(node.nodeValue || '')) {
                    node.nodeValue = node.nodeValue.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '');
                }
            });
        });
    }

    function forceBrand() {
        document.title = APP_NAME;
        document.querySelectorAll('.brand-text, .auth-card h1, .sidebar h1, [data-brand]').forEach((el) => {
            if (el.textContent.trim() !== APP_NAME) el.textContent = APP_NAME;
        });
    }

    function fixVisibleText(root = document.body) {
        if (!root) return;
        forceBrand();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
            const fixed = fixText(node.nodeValue);
            if (fixed !== node.nodeValue) node.nodeValue = fixed;
        });
        fixAttributes(root);
        hideRankingEmails(root);
        forceBrand();
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
        return (tasks || []).filter(task => !isExtraTask(task)).reduce((total, task) => total + taskHours(task), 0);
    }

    function studyCount(tasks) {
        return (tasks || []).filter(task => !isExtraTask(task) && isStudy(task)).length;
    }

    function taskId(task) {
        return [task?.id || '', task?.m || '', task?.a || '', task?.k || '', task?.l || '', task?.origemAtraso || ''].join('|').toLowerCase();
    }

    function normalizeTask(task, origem) {
        return { ...task, c: false, atraso: false, replanejado: false, origemAtraso: task?.origemAtraso || origem, l: task?.l === 'Extra' ? task.l : (task?.l || 'Estudo'), k: task?.k || 'E' };
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
            if (key >= todayKey) return;
            (data.metaFixa[key] || []).forEach(task => {
                if (!isExtraTask(task) && !isDone(task)) atrasos.push({ dia: key, task });
            });
        });
        return atrasos;
    }

    function encaixarAtrasosNoCronograma(atrasos, inicioDate) {
        const seen = new Set();
        atrasos.map(({ dia, task }) => normalizeTask(task, dia)).filter(task => {
            const id = taskId(task);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        }).forEach(task => placeTask(task, inicioDate));
    }

    function refresh(today) {
        if (typeof vDate !== 'undefined') vDate = new Date(today);
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderReplanejar === 'function') renderReplanejar();
        setTimeout(fixVisibleText, 0);
    }

    function replanejarAgoraCorrigido() {
        const data = getDb();
        if (!data) return;
        data.metaFixa = data.metaFixa || {};
        const today = cleanDate(new Date());
        const atrasos = getAtrasosAteHoje(today);
        if (!atrasos.length) {
            if (typeof showToast === 'function') showToast('Sem atrasos', 'Nenhuma pendÃªncia encontrada para replanejar.');
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
        saveNow();
        refresh(today);
        if (typeof showToast === 'function') showToast('Plant\u00e3o replanejado', 'Os atrasos foram redistribuÃ­dos respeitando as horas diÃ¡rias.');
    }

    function wrapRender(name) {
        if (typeof window[name] !== 'function' || window[name].__plantaoFixWrapped) return;
        const original = window[name];
        window[name] = function wrappedRender(...args) {
            const result = original.apply(this, args);
            setTimeout(fixVisibleText, 0);
            return result;
        };
        window[name].__plantaoFixWrapped = true;
    }

    function boot() {
        window.getAtrasosAteHoje = getAtrasosAteHoje;
        window.encaixarAtrasosNoCronograma = encaixarAtrasosNoCronograma;
        window.replanejarAgora = replanejarAgoraCorrigido;
        ['renderDiario', 'renderSemanal', 'updateDashboard', 'renderTree', 'renderFluxo', 'renderCiclo', 'renderReplanejar', 'renderRankingAlunos', 'renderPerfil'].forEach(wrapRender);
        fixVisibleText();
        setTimeout(fixVisibleText, 400);
        setTimeout(fixVisibleText, 1200);
        setTimeout(fixVisibleText, 2500);
        let pending = false;
        new MutationObserver(() => {
            if (pending) return;
            pending = true;
            setTimeout(() => { pending = false; fixVisibleText(); }, 50);
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
