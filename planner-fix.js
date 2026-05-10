(function plannerFix() {
    const APP_NAME = 'PLANTÃO';
    const STORAGE_KEY = 'prf_v120';
    const MAX_STUDY_PER_DAY = 2;

    const pad = n => String(n).padStart(2, '0');
    const cleanDate = value => {
        const d = new Date(value || new Date());
        d.setHours(0, 0, 0, 0);
        return d;
    };
    const dateKey = value => {
        const d = cleanDate(value);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const addDays = (date, amount) => {
        const d = cleanDate(date);
        d.setDate(d.getDate() + amount);
        return d;
    };
    const getDb = () => (typeof db !== 'undefined' ? db : window.db);

    function badScore(text) {
        return (String(text).match(/[ÃÂ�]/g) || []).length;
    }

    function decodeIfNeeded(value) {
        if (typeof value !== 'string') return value;
        let text = value;
        if (!/[ÃÂ�]/.test(text)) return text;
        try {
            const decoded = decodeURIComponent(escape(text));
            if (decoded && badScore(decoded) < badScore(text)) text = decoded;
        } catch (error) {}
        return text;
    }

    function fixText(value) {
        if (typeof value !== 'string') return value;
        let text = decodeIfNeeded(value);
        const pairs = [
            [/PLANT(?:ÃO|AO|ÃƒO|ÃƒÃO|�O|.?O)/gi, APP_NAME],
            [/RACIOC(?:Í|I|ÃƒÂ?|�)?NIO L(?:Ó|O|ÃƒÂ?|�)?GICO/gi, 'RACIOCÍNIO LÓGICO'],
            [/Portugu(?:ê|e|Ãª|�)s/gi, 'PORTUGUÊS'],
            [/Compreens(?:ã|a|Ã£|�)o/gi, 'Compreensão'],
            [/interpreta(?:çã|cao|Ã§Ã£|�)o/gi, 'interpretação'],
            [/mat(?:é|e|Ã©|�)ria/gi, 'matéria'],
            [/mat(?:é|e|Ã©|�)rias/gi, 'matérias'],
            [/Revis(?:ã|a|Ã£|�)o/gi, 'Revisão'],
            [/Quest(?:õ|o|Ãµ|�)es/gi, 'Questões'],
            [/Exerc(?:í|i|Ã­|�)cios/gi, 'Exercícios'],
            [/Lan(?:ç|c|Ã§|�)amentos/gi, 'Lançamentos'],
            [/Hor(?:á|a|Ã¡|�)rios/gi, 'Horários'],
            [/Di(?:á|a|Ã¡|�)rias/gi, 'Diárias'],
            [/Amanh(?:ã|a|Ã£|�)/gi, 'Amanhã'],
            [/Voc(?:ê|e|Ãª|�)/gi, 'Você'],
            [/Administra(?:çã|cao|Ã§Ã£|�)o p(?:ú|u|Ãº|�)blica/gi, 'Administração pública'],
            [/Precis(?:ã|a|Ã£|�)o/gi, 'Precisão'],
            [/Persegui(?:çã|cao|Ã§Ã£|�)o/gi, 'Perseguição'],
            [/Miss(?:ã|a|Ã£|�)o/gi, 'Missão'],
            [/Sequ(?:ê|e|Ãª|�)ncia/gi, 'Sequência'],
            [/conclu(?:í|i|Ã­|�)das/gi, 'concluídas'],
            [/j(?:á|a|Ã¡|�) dominados/gi, 'já dominados'],
            [/amanh(?:ã|a|Ã£|�)/gi, 'amanhã'],
            [/recome(?:ç|c|Ã§|�)a/gi, 'recomeça'],
            [/lan(?:ç|c|Ã§|�)ados/gi, 'lançados']
        ];
        pairs.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
        text = text.replace(/\bN(?:Ã|A|�)?O\b/g, 'NÃO').replace(/\bn(?:ã|a|Ã|�)?o\b/g, 'não');
        text = text.replace(/ATRASO\s*-\s*/gi, '');
        return text;
    }

    function taskKey(task) {
        return `${fixText(task?.m || '')}|${fixText(task?.a || '')}|${task?.k || task?.l || ''}`.toLowerCase();
    }

    function isExtra(task) {
        return task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    }

    function hasAtrasoText(task) {
        if (!task || typeof task !== 'object') return false;
        return ['l', 'k', 'm', 'a', 'origemAtraso'].some(key => /ATRASO/i.test(String(task[key] || '')));
    }

    function isDone(task) {
        return task?.c === true;
    }

    function isStudy(task) {
        return task?.k === 'E' || task?.l === 'Estudo' || !task?.k;
    }

    function hours(task) {
        if (typeof task?.h === 'number') return Math.max(0.5, task.h || 1);
        if (task?.h && typeof task.h === 'object') return Math.max(0.5, parseFloat(task.h[task.k] || task.h.E || 1));
        return Math.max(0.5, parseFloat(task?.h) || 1);
    }

    function capacity(date) {
        const data = getDb();
        return Math.max(0, parseFloat(data?.h?.[cleanDate(date).getDay()]) || 0);
    }

    function normalizeTask(task) {
        if (!task || typeof task !== 'object') return task;
        const wasAtraso = hasAtrasoText(task) || task.atraso === true;
        if (typeof task.m === 'string') task.m = fixText(task.m).toUpperCase();
        if (typeof task.a === 'string') task.a = fixText(task.a);
        if (typeof task.l === 'string') task.l = fixText(task.l);
        if (typeof task.k === 'string') task.k = fixText(task.k);
        if (wasAtraso) {
            task.origemAtraso = task.origemAtraso || 'replanejado';
            task.l = 'Estudo';
            task.k = 'E';
            task.atraso = false;
        }
        return task;
    }

    function normalizeData() {
        const data = getDb();
        if (!data) return data;
        data.lista?.forEach(normalizeTask);
        data.ciclo = (data.ciclo || []).map(item => fixText(item).toUpperCase());
        data.metaFixa = data.metaFixa || {};
        Object.keys(data.metaFixa).forEach(key => {
            const seen = new Set();
            data.metaFixa[key] = (data.metaFixa[key] || [])
                .map(normalizeTask)
                .filter(task => task && (task.m || task.a))
                .filter(task => {
                    const id = taskKey(task);
                    if (seen.has(id) && !isDone(task)) return false;
                    seen.add(id);
                    return true;
                });
            if (!data.metaFixa[key].length) delete data.metaFixa[key];
        });
        return data;
    }

    function canPlace(dayTasks, date, task) {
        if (isExtra(task)) return true;
        const max = capacity(date);
        if (max <= 0) return false;
        const used = dayTasks.filter(t => !isExtra(t)).reduce((sum, t) => sum + hours(t), 0);
        const studies = dayTasks.filter(t => !isExtra(t) && isStudy(t)).length;
        if (used + hours(task) > max) return false;
        if (isStudy(task) && studies >= MAX_STUDY_PER_DAY) return false;
        return true;
    }

    function placeTask(task, startDate) {
        const data = getDb();
        for (let i = 0; i < 365; i++) {
            const date = addDays(startDate, i);
            const key = dateKey(date);
            const tasks = data.metaFixa[key] || [];
            if (canPlace(tasks, date, task)) {
                data.metaFixa[key] = tasks.concat(task);
                return key;
            }
        }
        const fallback = dateKey(startDate);
        data.metaFixa[fallback] = (data.metaFixa[fallback] || []).concat(task);
        return fallback;
    }

    function saveNow() {
        const data = getDb();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {}
        if (typeof save === 'function') save();
    }

    function needsReplan(task, key, todayKey) {
        return !isExtra(task) && !isDone(task) && (
            key <= todayKey ||
            task?.replanejado === true ||
            task?.atraso === true ||
            hasAtrasoText(task)
        );
    }

    function enforceDailyLimits(startDate) {
        const data = getDb();
        const startKey = dateKey(startDate);
        const overflow = [];
        Object.keys(data.metaFixa || {}).sort().forEach(key => {
            if (key < startKey) return;
            const date = cleanDate(new Date(`${key}T00:00:00`));
            const kept = [];
            (data.metaFixa[key] || []).forEach(task => {
                const normalized = normalizeTask(task);
                if (isDone(normalized) || canPlace(kept, date, normalized)) kept.push(normalized);
                else overflow.push({ ...normalized, c: false, replanejado: false, atraso: false });
            });
            if (kept.length) data.metaFixa[key] = kept;
            else delete data.metaFixa[key];
        });
        overflow.forEach(task => placeTask(task, startDate));
    }

    function redraw(today) {
        if (typeof vDate !== 'undefined') vDate = today;
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderReplanejar === 'function') renderReplanejar();
        setTimeout(fixVisibleText, 0);
    }

    function replanejarCorrigido(options = {}) {
        const data = getDb();
        if (!data) return;
        data.metaFixa = data.metaFixa || {};
        const today = cleanDate(new Date());
        const todayKey = dateKey(today);
        const startDate = addDays(today, 1);
        const queue = [];
        const keepByDay = {};

        Object.keys(data.metaFixa).sort().forEach(key => {
            (data.metaFixa[key] || []).forEach(rawTask => {
                const move = needsReplan(rawTask, key, todayKey);
                const task = normalizeTask({ ...rawTask });
                if (move) {
                    queue.push({
                        ...task,
                        c: false,
                        l: 'Estudo',
                        k: 'E',
                        atraso: false,
                        replanejado: false,
                        origemAtraso: rawTask.origemAtraso || (key <= todayKey ? key : 'replanejado')
                    });
                } else {
                    if (!keepByDay[key]) keepByDay[key] = [];
                    keepByDay[key].push(task);
                }
            });
        });

        data.metaFixa = keepByDay;
        const seen = new Set();
        const uniqueQueue = queue.filter(task => {
            const id = taskKey(task);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        uniqueQueue.forEach(task => placeTask(task, startDate));
        enforceDailyLimits(startDate);
        normalizeData();
        saveNow();
        redraw(today);

        if (!options.silent && typeof showToast === 'function') {
            showToast('Replanejamento feito', `${uniqueQueue.length} atividade(s) realocada(s) a partir de amanhã respeitando sua meta diária.`);
        }
    }

    function fixVisibleText(root = document.body) {
        if (!root) return;
        document.title = APP_NAME;
        document.querySelectorAll('.logo-box').forEach(el => {
            const icon = el.querySelector('i')?.outerHTML || '<i class="fas fa-shield-halved"></i>';
            el.innerHTML = `${icon} ${APP_NAME}`;
        });
        document.querySelectorAll('h2, h3, h1, span, p, small, button, label, option, div').forEach(el => {
            if (el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE) {
                const fixed = fixText(el.textContent);
                if (fixed !== el.textContent) el.textContent = fixed;
            }
        });
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const fixed = fixText(node.nodeValue);
            if (fixed !== node.nodeValue) node.nodeValue = fixed;
        });
    }

    function boot() {
        window.replanejarAgora = () => replanejarCorrigido({ silent: false });
        const run = () => {
            window.replanejarAgora = () => replanejarCorrigido({ silent: false });
            replanejarCorrigido({ silent: true });
            fixVisibleText();
        };
        setTimeout(run, 250);
        setTimeout(run, 1000);
        setTimeout(run, 2500);
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
