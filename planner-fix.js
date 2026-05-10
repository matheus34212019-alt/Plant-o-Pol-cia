(function plannerFix() {
    const APP_NAME = 'PLANTÃO';
    const STORAGE_KEY = 'prf_v120';
    const MAX_STUDY_DAY = 2;

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
    const keyToDate = key => {
        const [y, m, d] = String(key).split('-').map(Number);
        return cleanDate(new Date(y, (m || 1) - 1, d || 1));
    };
    const addDays = (date, amount) => {
        const d = cleanDate(date);
        d.setDate(d.getDate() + amount);
        return d;
    };
    const getDb = () => (typeof db !== 'undefined' ? db : window.db);
    const taskKey = task => `${fixText(task?.m || '')}|${fixText(task?.a || '')}|${task?.k || task?.l || ''}`.toLowerCase();
    const isExtra = task => task?.extra === true || task?.l === 'Extra';
    const isFakeAtraso = task => /^ATRASO[_\s-]/i.test(String(task?.l || '')) || /^ATRASO[_\s-]/i.test(String(task?.k || ''));
    const isDone = task => task?.c === true;
    const isStudy = task => task?.k === 'E' || !task?.k || /estudo|atraso/i.test(String(task?.l || ''));
    const hours = task => {
        if (typeof task?.h === 'number') return Math.max(0.5, task.h || 1);
        if (task?.h && typeof task.h === 'object') return Math.max(0.5, parseFloat(task.h[task.k] || task.h.E || 1));
        return Math.max(0.5, parseFloat(task?.h) || 1);
    };
    const capacity = date => Math.max(0, parseFloat(getDb()?.h?.[cleanDate(date).getDay()]) || 0);

    function fixText(value) {
        if (typeof value !== 'string') return value;
        return value
            .replace(/PLANT.?O/gi, APP_NAME)
            .replace(/Plant.?o/g, APP_NAME)
            .replace(/Portugu.{1,3}s/gi, 'PORTUGUÊS')
            .replace(/Racioc.{1,3}nio L.{1,3}gico/gi, 'RACIOCÍNIO LÓGICO')
            .replace(/Compreens.{1,3}o/gi, 'Compreensão')
            .replace(/interpreta.{1,3}o/gi, 'interpretação')
            .replace(/mat.{1,3}ria/gi, 'matéria')
            .replace(/mat.{1,3}rias/gi, 'matérias')
            .replace(/Revis.{1,3}o/gi, 'Revisão')
            .replace(/Quest.{1,3}es/gi, 'Questões')
            .replace(/Exerc.{1,3}cios/gi, 'Exercícios')
            .replace(/Lan.{1,3}amentos/gi, 'Lançamentos')
            .replace(/Hor.{1,3}rios/gi, 'Horários')
            .replace(/Di.{1,3}rias/gi, 'Diárias')
            .replace(/Amanh.?/gi, 'Amanhã')
            .replace(/Voc.?/gi, 'Você')
            .replace(/n.?o/gi, match => match === match.toUpperCase() ? 'NÃO' : 'não')
            .replace(/Administra.{1,3}o p.{1,3}blica/gi, 'Administração pública');
    }

    function normalizeTask(task) {
        if (!task || typeof task !== 'object') return task;
        if (typeof task.m === 'string') task.m = fixText(task.m).toUpperCase();
        if (typeof task.a === 'string') task.a = fixText(task.a);
        if (typeof task.l === 'string') task.l = fixText(task.l);
        if (isFakeAtraso(task)) {
            task.origemAtraso = task.origemAtraso || String(task.l || task.k).replace(/^ATRASO[_\s-]*/i, '').trim();
            task.l = 'Estudo';
            task.k = 'E';
            task.atraso = false;
            task.replanejado = true;
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
        const used = dayTasks.filter(t => !isExtra(t)).reduce((sum, t) => sum + hours(t), 0);
        const studies = dayTasks.filter(t => !isExtra(t) && isStudy(t)).length;
        if (max <= 0) return false;
        if (used + hours(task) > max) return false;
        if (isStudy(task) && studies >= MAX_STUDY_DAY) return false;
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

    function replanejarCorrigido() {
        const data = normalizeData();
        if (!data) return;
        const today = cleanDate(new Date());
        const todayKey = dateKey(today);
        const queue = [];
        const keepByDay = {};

        Object.keys(data.metaFixa || {}).sort().forEach(key => {
            const remaining = [];
            (data.metaFixa[key] || []).forEach(task => {
                const shouldMove = !isExtra(task) && !isDone(task) && (key < todayKey || isFakeAtraso(task) || task.replanejado === true);
                if (shouldMove) queue.push({ ...normalizeTask(task), c: false, replanejado: true, origemAtraso: task.origemAtraso || (key < todayKey ? key : undefined) });
                else remaining.push(task);
            });
            if (remaining.length) keepByDay[key] = remaining;
        });

        data.metaFixa = keepByDay;
        const seen = new Set();
        const uniqueQueue = queue.filter(task => {
            const id = taskKey(task);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        uniqueQueue.forEach(task => placeTask(task, today));
        normalizeData();
        saveNow();

        if (typeof vDate !== 'undefined') vDate = today;
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderReplanejar === 'function') renderReplanejar();
        if (typeof showToast === 'function') showToast('Replanejamento feito', `${uniqueQueue.length} atividade(s) realocada(s) respeitando sua meta diária.`);
        fixVisibleText();
    }

    function fixVisibleText(root = document.body) {
        if (!root) return;
        document.title = APP_NAME;
        document.querySelectorAll('.logo-box').forEach(el => {
            const icon = el.querySelector('i')?.outerHTML || '<i class="fas fa-shield-halved"></i>';
            el.innerHTML = `${icon} ${APP_NAME}`;
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
        normalizeData();
        window.replanejarAgora = replanejarCorrigido;
        fixVisibleText();
        setTimeout(() => { window.replanejarAgora = replanejarCorrigido; fixVisibleText(); }, 700);
        setTimeout(() => { window.replanejarAgora = replanejarCorrigido; fixVisibleText(); }, 1800);
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
