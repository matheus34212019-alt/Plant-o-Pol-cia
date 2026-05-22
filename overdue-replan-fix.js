(function plantaoOverdueReplanFix() {
    if(window.__plantaoOverdueReplanFix) return;
    window.__plantaoOverdueReplanFix = true;

    const VERSION = 'v223-overdue-replan';
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
        const dateKeyFn = fn('dateKey');
        if(dateKeyFn) return dateKeyFn(date);
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    function dateFromKey(key) {
        const keyToDate = fn('keyToDate');
        if(keyToDate) return keyToDate(key);
        const [day, month, year] = String(key || '').split('/').map(Number);
        return new Date(year || 2000, Math.max(0, (month || 1) - 1), day || 1);
    }

    function startOfDay(value) {
        const d = value instanceof Date ? new Date(value) : dateFromKey(value);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date, days) {
        const addDaysFn = fn('addDays');
        if(addDaysFn) return addDaysFn(date, days);
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    }

    function isExtra(task) {
        const isExtraTask = fn('isExtraTask');
        if(isExtraTask) return Boolean(isExtraTask(task));
        return Boolean(task && (task.extra === true || task.l === 'Extra' || task.k === 'Extra'));
    }

    function planned(tasks) {
        return (Array.isArray(tasks) ? tasks : []).filter(task => !isExtra(task));
    }

    function hours(task) {
        return Math.max(0, Number.parseFloat(task?.h) || 0);
    }

    function roundHours(value) {
        return Math.round(Math.max(0, value) * 10) / 10;
    }

    function taskIdentity(task) {
        return [
            task?.itemId || task?.id || '',
            task?.m || '',
            task?.a || '',
            task?.k || '',
            task?.l || ''
        ].join('|').toLowerCase();
    }

    function dayLimit(data, date) {
        return Math.max(0, Number.parseFloat(data?.h?.[date.getDay()]) || 0);
    }

    function plannedHours(tasks) {
        return planned(tasks).reduce((sum, task) => sum + hours(task), 0);
    }

    function ensureDay(data, key) {
        if(!Array.isArray(data.metaFixa[key])) data.metaFixa[key] = [];
        return data.metaFixa[key];
    }

    function preserveOldDay(data, key) {
        const tasks = Array.isArray(data.metaFixa[key]) ? data.metaFixa[key] : [];
        const kept = tasks.filter(task => task?.c || isExtra(task));
        if(kept.length) data.metaFixa[key] = kept;
        else delete data.metaFixa[key];
    }

    function existingFutureTask(data, task, today) {
        const identity = taskIdentity(task);
        return Object.entries(data.metaFixa || {}).some(([key, tasks]) => {
            if(startOfDay(key) < today) return false;
            return planned(tasks).some(candidate => !candidate.c && taskIdentity(candidate) === identity);
        });
    }

    function makeMovedTask(task, key, blockHours) {
        const next = clone(task);
        next.c = false;
        next.h = roundHours(blockHours);
        next.data = key;
        next.replanejadoDe = task.data || '';
        next.replanejadoEm = new Date().toISOString();
        delete next.perf;
        return next;
    }

    function addTaskToFuture(data, task, today) {
        if(existingFutureTask(data, task, today)) return { moved: true, placedHours: hours(task), reused: true };
        let remaining = roundHours(hours(task));
        let placedHours = 0;

        for(let offset = 0; remaining > EPSILON && offset <= MAX_LOOKAHEAD_DAYS; offset += 1) {
            const date = startOfDay(addDays(today, offset));
            const key = dayKey(date);
            const limit = dayLimit(data, date);
            if(limit <= EPSILON) continue;
            if(Array.isArray(data.diasPausados) && data.diasPausados.includes(key)) continue;

            const tasks = ensureDay(data, key);
            const free = roundHours(Math.max(0, limit - plannedHours(tasks)));
            if(free <= EPSILON) continue;

            const block = roundHours(Math.min(free, remaining));
            if(block <= EPSILON) continue;
            tasks.push(makeMovedTask(task, key, block));
            remaining = roundHours(remaining - block);
            placedHours = roundHours(placedHours + block);

            const lockDay = fn('atualizarPlanoDiaTravado');
            if(lockDay) {
                try { lockDay(key); } catch(_) {}
            }
        }

        return { moved: remaining <= EPSILON, placedHours, remaining };
    }

    function collectOverdue(data, today) {
        const collector = fn('getAtrasosAteHoje');
        if(collector) return collector(today).map(row => ({ task: clone(row.task), dia: row.dia }));
        const out = [];
        Object.entries(data.metaFixa || {}).forEach(([key, tasks]) => {
            if(startOfDay(key) >= today) return;
            planned(tasks).filter(task => !task.c).forEach(task => out.push({ task: clone(task), dia: key }));
        });
        return out.sort((a, b) => startOfDay(a.dia) - startOfDay(b.dia));
    }

    function refreshUi(today) {
        const save = fn('save');
        const updateDashboard = fn('updateDashboard');
        const init = fn('init');
        if(save) save();
        if(updateDashboard) updateDashboard();
        if(init) {
            try { vDate = new Date(today); } catch(_) {}
            init();
        }
    }

    function replanejarAtrasosComRedistribuicao() {
        const data = state();
        if(!data || !data.metaFixa) return;
        const today = startOfDay(new Date());
        const overdue = collectOverdue(data, today);
        const toast = fn('showToast');

        if(!overdue.length) {
            if(toast) toast('Sem atrasos', 'Nenhuma pendência antiga foi encontrada para replanejar.');
            return;
        }

        const confirmAction = fn('confirmarAcaoPlano');
        if(confirmAction && !confirmAction(
            'Replanejar atrasos',
            `${overdue.length} atividade(s) pendente(s) serão redistribuídas nos próximos dias.`
        )) return;

        [...new Set(overdue.map(row => row.dia))].forEach(key => preserveOldDay(data, key));

        let moved = 0;
        let pending = 0;
        overdue.forEach(({ task, dia }) => {
            const result = addTaskToFuture(data, { ...task, data: dia }, today);
            if(result.moved) moved += 1;
            else pending += 1;
        });

        refreshUi(today);
        if(toast) {
            const text = pending
                ? `${moved} atividade(s) foram redistribuídas. Ajuste suas horas diárias para encaixar ${pending} pendência(s) restantes.`
                : 'As pendências antigas foram removidas dos dias atrasados e redistribuídas no cronograma futuro.';
            toast('Atrasos replanejados', text);
        }
    }

    function install() {
        const current = fn('replanejarAgora');
        if(!current || current.__plantaoOverdueReplanFix) return false;
        replanejarAtrasosComRedistribuicao.__plantaoOverdueReplanFix = true;
        replanejarAtrasosComRedistribuicao.__plantaoOriginal = current;
        setFn('replanejarAgora', replanejarAtrasosComRedistribuicao);
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
