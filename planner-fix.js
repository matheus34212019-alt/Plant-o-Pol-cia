(function plannerFix() {
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
    }

    function replanejarAgoraCorrigido() {
        const data = getDb();
        if (!data) return;
        data.metaFixa = data.metaFixa || {};

        const today = cleanDate(new Date());
        const atrasos = getAtrasosAteHoje(today);
        if (!atrasos.length) {
            if (typeof showToast === 'function') showToast('Sem atrasos', 'Nenhuma pendencia encontrada para replanejar.');
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

        if (typeof showToast === 'function') {
            showToast('Plantao replanejado', 'Os atrasos foram redistribuidos respeitando as horas diarias.');
        }
    }

    function boot() {
        window.getAtrasosAteHoje = getAtrasosAteHoje;
        window.encaixarAtrasosNoCronograma = encaixarAtrasosNoCronograma;
        window.replanejarAgora = replanejarAgoraCorrigido;
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
