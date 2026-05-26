(function plantaoOverdueReplanFix() {
    if(window.__plantaoOverdueReplanFix) return;
    window.__plantaoOverdueReplanFix = true;

    const VERSION = 'v224-atomic-overdue-replan';
    const EPSILON = 0.01;
    const MAX_LOOKAHEAD_DAYS = 540;

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function setFn(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function state() {
        try { return typeof db !== 'undefined' ? db : window.db; } catch(_) { return window.db; }
    }

    function clone(value) {
        try { return JSON.parse(JSON.stringify(value)); } catch(_) { return { ...(value || {}) }; }
    }

    function dayKey(date) {
        const local = fn('dateKey');
        if(local) return local(date);
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    function dateFromKey(key) {
        const local = fn('keyToDate');
        if(local) return local(key);
        const [day, month, year] = String(key || '').split('/').map(Number);
        return new Date(year || 2000, Math.max(0, (month || 1) - 1), day || 1);
    }

    function startOfDay(value) {
        const d = value instanceof Date ? new Date(value) : dateFromKey(value);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function plusDays(date, days) {
        const local = fn('addDays');
        if(local) return local(date, days);
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    }

    function isExtra(task) {
        const local = fn('isExtraTask');
        if(local) return Boolean(local(task));
        return Boolean(task && (task.extra === true || task.l === 'Extra' || task.k === 'Extra'));
    }

    function hours(task) {
        return Math.max(0, Number.parseFloat(task?.h) || 0);
    }

    function rounded(value) {
        return Math.round(Math.max(0, value) * 10) / 10;
    }

    function limitForDay(data, date) {
        return Math.max(0, Number.parseFloat(data?.h?.[date.getDay()]) || 0);
    }

    function plannedHours(tasks) {
        return (Array.isArray(tasks) ? tasks : [])
            .filter(task => !isExtra(task))
            .reduce((sum, task) => sum + hours(task), 0);
    }

    function collectOverdue(data, today) {
        const rows = [];
        Object.entries(data.metaFixa || {}).forEach(([key, tasks]) => {
            if(startOfDay(key) >= today) return;
            (Array.isArray(tasks) ? tasks : []).forEach((task, index) => {
                if(task && !task.c && !isExtra(task)) rows.push({ id: `${key}-${index}`, day: key, index, task: clone(task) });
            });
        });
        return rows.sort((a, b) => startOfDay(a.day) - startOfDay(b.day) || a.index - b.index);
    }

    function removeOriginal(draft, row) {
        const tasks = Array.isArray(draft.metaFixa?.[row.day]) ? draft.metaFixa[row.day] : null;
        const index = tasks ? tasks.findIndex(task => task?.__replanSourceId === row.id) : -1;
        if(index < 0 || tasks[index].c || isExtra(tasks[index])) return false;
        tasks.splice(index, 1);
        if(!tasks.length) delete draft.metaFixa[row.day];
        return true;
    }

    function movedTask(task, destination, blockHours, origin) {
        const next = clone(task);
        next.c = false;
        next.h = rounded(blockHours);
        next.data = destination;
        next.replanejadoDe = origin;
        next.replanejadoEm = new Date().toISOString();
        delete next.perf;
        delete next.__replanSourceId;
        return next;
    }

    function placeEntireTask(draft, row, today) {
        let remaining = rounded(hours(row.task));
        const touched = [];
        for(let offset = 0; remaining > EPSILON && offset <= MAX_LOOKAHEAD_DAYS; offset += 1) {
            const date = startOfDay(plusDays(today, offset));
            const key = dayKey(date);
            const limit = limitForDay(draft, date);
            if(limit <= EPSILON || (draft.diasPausados || []).includes(key)) continue;
            const tasks = Array.isArray(draft.metaFixa[key]) ? draft.metaFixa[key] : (draft.metaFixa[key] = []);
            const available = rounded(Math.max(0, limit - plannedHours(tasks)));
            if(available <= EPSILON) continue;
            const block = rounded(Math.min(available, remaining));
            tasks.push(movedTask(row.task, key, block, row.day));
            touched.push(key);
            remaining = rounded(remaining - block);
        }
        return { complete: remaining <= EPSILON, touched };
    }

    function commit(data, draft, touched) {
        Object.values(draft.metaFixa || {}).forEach(tasks => {
            (Array.isArray(tasks) ? tasks : []).forEach(task => delete task.__replanSourceId);
        });
        data.metaFixa = draft.metaFixa;
        const lock = fn('atualizarPlanoDiaTravado');
        if(lock) [...new Set(touched)].forEach(day => {
            try { lock(day); } catch(_) {}
        });
        const save = fn('save');
        if(save) save();
        const dashboard = fn('updateDashboard');
        if(dashboard) dashboard();
        const init = fn('init');
        if(init) init();
    }

    function replanejarAtrasosAtomico() {
        const data = state();
        if(!data?.metaFixa) return;
        const today = startOfDay(new Date());
        const overdue = collectOverdue(data, today);
        const toast = fn('showToast');
        if(!overdue.length) {
            if(toast) toast('Sem atrasos', 'Nenhuma pend\u00eancia antiga foi encontrada.');
            return;
        }
        const confirmAction = fn('confirmarAcaoPlano');
        if(confirmAction && !confirmAction('Replanejar atrasos', `${overdue.length} atividade(s) pendente(s) ser\u00e3o redistribu\u00eddas.`)) return;

        let draft = clone(data);
        overdue.forEach(row => {
            const task = draft.metaFixa?.[row.day]?.[row.index];
            if(task) task.__replanSourceId = row.id;
        });
        let moved = 0;
        let pending = 0;
        const touched = [];
        overdue.forEach(row => {
            const candidate = clone(draft);
            if(!removeOriginal(candidate, row)) {
                pending += 1;
                return;
            }
            const placement = placeEntireTask(candidate, row, today);
            if(!placement.complete) {
                pending += 1;
                return;
            }
            draft = candidate;
            moved += 1;
            touched.push(row.day, ...placement.touched);
        });

        if(moved) commit(data, draft, touched);
        if(!toast) return;
        if(pending) {
            toast('Replanejamento conclu\u00eddo', `${moved} atividade(s) movida(s). ${pending} permanecem em atraso por falta de horas livres.`);
        } else {
            toast('Replanejamento conclu\u00eddo', 'Todas as pend\u00eancias foram movidas para dias com capacidade.');
        }
    }

    function install() {
        const current = fn('replanejarAgora');
        if(!current || current.__plantaoOverdueReplanFix) return false;
        replanejarAtrasosAtomico.__plantaoOverdueReplanFix = true;
        replanejarAtrasosAtomico.__plantaoOriginal = current;
        setFn('replanejarAgora', replanejarAtrasosAtomico);
        document.documentElement.dataset.overdueReplan = VERSION;
        return true;
    }

    if(!install()) {
        const timer = setInterval(() => {
            if(install()) clearInterval(timer);
        }, 250);
        setTimeout(() => {
            clearInterval(timer);
            install();
        }, 9000);
    }
})();
