(function plantaoRulesPatch() {
    const STORAGE_KEY = 'prf_v120';
    const MIN_TASK_HOURS = 0.5;
    const MAX_HOURS_PER_MATTER_DAY = 2;

    const pad = n => String(n).padStart(2, '0');
    const roundHours = value => Math.round((parseFloat(value) || 0) * 10) / 10;
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
    const getViewDate = () => (typeof vDate !== 'undefined' ? cleanDate(vDate) : cleanDate(new Date()));
    const isDone = task => task?.c === true;
    const isExtraTask = task => task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    const isStudy = task => task?.k === 'E' || task?.l === 'Estudo' || !task?.k;

    function appReady(state = getDb()) {
        return !!(state && Array.isArray(state.lista) && state.metaFixa && typeof state.metaFixa === 'object');
    }

    function installQuietToasts() {
        if (typeof window.showToast !== 'function' || window.showToast.__quietPlannerV265) return;
        const original = window.showToast;
        const quietTitles = /cronograma|dados sincronizados|progresso preservado|nuvem ativada|tempo extra replanejado|rotina|planejamento/i;
        window.showToast = function quietPlannerToast(title, message, type) {
            const text = `${title || ''} ${message || ''}`;
            const important = /erro|senha|login|acesso|bloqueio|pendente|indispon/i.test(text);
            if (quietTitles.test(text) && !important) return;
            return original.apply(this, arguments);
        };
        window.showToast.__quietPlannerV265 = true;
    }

    function taskHours(task) {
        if (typeof task?.h === 'number') return Math.max(0, task.h || 0);
        if (task?.h && typeof task.h === 'object') return Math.max(0, parseFloat(task.h[task.k] || task.h.E || 0));
        return Math.max(0, parseFloat(task?.h) || 0);
    }

    function setTaskHours(task, hours) {
        const value = roundHours(Math.max(0, parseFloat(hours) || 0));
        task.h = value;
        task.hExtra = value;
        return task;
    }

    function samePlannedItem(task, item) {
        if (!task || !item) return false;
        if (task.itemId && item.id && task.itemId === item.id) return true;
        if (task.id && item.id && task.id === item.id) return true;
        return task.m === item.m && task.a === item.a;
    }

    function findItemForTask(task, state = getDb()) {
        return (state?.lista || []).find(item => samePlannedItem(task, item)) || null;
    }

    function itemToTask(item) {
        return { id: item?.id, itemId: item?.id, m: item?.m, a: item?.a, ordem: item?.ordem, l: 'Estudo', k: 'E', c: false };
    }

    function orderOf(entry, state = getDb()) {
        const direct = parseFloat(entry?.ordem);
        if (Number.isFinite(direct)) return direct;
        const item = findItemForTask(entry, state) || entry;
        const fromItem = parseFloat(item?.ordem);
        return Number.isFinite(fromItem) ? fromItem : 0;
    }

    function openInitialStudyForMatter(materia, state = getDb()) {
        if (!appReady(state) || !materia) return null;
        return (state.lista || [])
            .filter(item => item.m === materia && !item.f && (parseFloat(item.hF) || 0) < (parseFloat(item.h?.E) || 0) - 0.01)
            .sort((a, b) => orderOf(a, state) - orderOf(b, state))[0] || null;
    }

    function pendingExtraForMatter(materia, state = getDb()) {
        if (!appReady(state) || !materia) return null;
        const tasks = Object.values(state.metaFixa || {}).flat();
        const extraTask = tasks.find(task => task?.extraStudy === true && !isDone(task) && task.m === materia);
        if (extraTask) return extraTask;
        return (state.lista || []).find(item => item.m === materia && (parseFloat(item.extraTeoria) || 0) > 0.01 && (parseFloat(item.hF) || 0) < (parseFloat(item.h?.E) || 0) - 0.01) || null;
    }

    function isLaterSameMatter(task, blocker, state = getDb()) {
        if (!task || !blocker || task.m !== blocker.m || task.a === blocker.a || isExtraTask(task) || isDone(task)) return false;
        const taskOrder = orderOf(task, state);
        const blockerOrder = orderOf(blocker, state);
        return taskOrder && blockerOrder ? taskOrder > blockerOrder : true;
    }

    function blockedByCycle(task, state = getDb()) {
        if (!appReady(state) || !task || isDone(task) || isExtraTask(task)) return false;
        const extraBlocker = pendingExtraForMatter(task.m, state);
        if (extraBlocker && isLaterSameMatter(task, extraBlocker, state)) return true;
        const openInitial = openInitialStudyForMatter(task.m, state);
        if (!openInitial) return false;
        if (task.k !== 'E') return true;
        const item = findItemForTask(task, state);
        return !!item && item.id !== openInitial.id;
    }

    function saveNow() {
        const data = getDb();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {}
        if (typeof save === 'function') save();
    }

    function filterInvalidScheduledTasks(state = getDb()) {
        if (!appReady(state)) return false;
        let changed = false;
        Object.keys(state.metaFixa || {}).forEach(key => {
            const before = state.metaFixa[key] || [];
            const after = before.filter(task => !blockedByCycle(task, state));
            if (after.length !== before.length) {
                changed = true;
                if (after.length) state.metaFixa[key] = after;
                else delete state.metaFixa[key];
            }
        });
        return changed;
    }

    function dayCapacity(date) {
        const data = getDb();
        return Math.max(0, parseFloat(data?.h?.[cleanDate(date).getDay()]) || 0);
    }

    function dayUsage(tasks) {
        return (tasks || []).filter(task => !isExtraTask(task)).reduce((sum, task) => sum + taskHours(task), 0);
    }

    function matterUsage(tasks, materia) {
        return (tasks || []).filter(task => !isExtraTask(task) && task?.m === materia).reduce((sum, task) => sum + taskHours(task), 0);
    }

    function canFit(tasks, date, task) {
        if (isExtraTask(task) || isDone(task)) return true;
        const capacity = dayCapacity(date);
        const hours = taskHours(task);
        if (capacity <= 0 || hours <= 0) return false;
        if (dayUsage(tasks) + hours > capacity + 0.01) return false;
        if (task?.m && matterUsage(tasks, task.m) + hours > MAX_HOURS_PER_MATTER_DAY + 0.01) return false;
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
        const fallback = dateKey(addDays(startDate, 1));
        data.metaFixa[fallback] = (data.metaFixa[fallback] || []).concat(task);
        return fallback;
    }

    function makeExtraStudyTask(baseTask, item, hours, originDate) {
        return setTaskHours({
            ...baseTask,
            id: `${item?.id || baseTask?.id || 'extra'}-tempo-extra-${Date.now()}`,
            itemId: item?.id || baseTask?.itemId,
            m: item?.m || baseTask?.m,
            a: item?.a || baseTask?.a,
            ordem: item?.ordem ?? baseTask?.ordem,
            l: 'Estudo',
            k: 'E',
            c: false,
            extraStudy: true,
            tempoExtraPendente: true,
            origemTempoExtra: originDate || dateKey(new Date()),
            f: false
        }, hours);
    }

    function markItemPending(item, totalHours, extraHours, actualStudied) {
        item.h = item.h || {};
        item.h.E = roundHours(totalHours);
        item.hF = roundHours(actualStudied);
        item.extraTeoria = roundHours(extraHours);
        item.extraTeoriaSaldoCorrigido = true;
        item.done = item.done || {E:false, Rev:false, Ex:false};
        item.done.E = false;
        item.done.Rev = false;
        item.done.Ex = false;
        item.f = false;
        item.sinalizado = false;
        item.cicloConcluidoManual = false;
        item.revCycle = null;
    }

    function setCompletedStudyCard(item, hours) {
        const data = getDb();
        const entries = Object.values(data?.metaFixa || {}).flat().filter(task => task?.k === 'E' && !isExtraTask(task) && isDone(task) && samePlannedItem(task, item));
        if (entries[0]) {
            entries[0].h = roundHours(hours);
            entries[0].hReal = roundHours(hours);
            entries[0].tempoLancado = roundHours(hours);
        }
    }

    function getPendingTheoryTask() {
        const data = getDb();
        const pending = typeof teoriaPendente !== 'undefined' ? teoriaPendente : null;
        if (pending?.item) return pending.item;
        if (pending?.itemId) {
            const originKey = pending.dK || dateKey(getViewDate());
            const fromDay = (data?.metaFixa?.[originKey] || []).find(task => task.itemId === pending.itemId || task.id === pending.itemId);
            if (fromDay) return fromDay;
            const fromList = (data?.lista || []).find(item => item.id === pending.itemId);
            if (fromList) return itemToTask(fromList);
        }
        const todayTasks = data?.metaFixa?.[dateKey(getViewDate())] || [];
        return todayTasks.find(task => isStudy(task) && !isExtraTask(task) && isDone(task)) || todayTasks.find(task => isStudy(task) && !isExtraTask(task));
    }

    function addExtraStudyForAnotherDay(hours) {
        const data = getDb();
        if (!appReady(data)) return false;
        const baseTask = getPendingTheoryTask();
        const item = findItemForTask(baseTask, data);
        if (!baseTask || !item) return false;
        const today = getViewDate();
        const extraHours = Math.max(MIN_TASK_HOURS, parseFloat(hours) || 0);
        const totalBefore = roundHours(parseFloat(item.h?.E) || taskHours(baseTask));
        const previousExtra = roundHours(parseFloat(item.extraTeoria) || 0);
        const nextExtra = roundHours(previousExtra + extraHours);
        const actualStudied = roundHours(Math.max(0, totalBefore - nextExtra));
        markItemPending(item, totalBefore, nextExtra, actualStudied);
        setCompletedStudyCard(item, actualStudied);
        placeTask(makeExtraStudyTask(baseTask, item, extraHours, dateKey(today)), today);
        filterInvalidScheduledTasks(data);
        saveNow();
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderLancamentos === 'function') renderLancamentos();
        if (typeof fecharModais === 'function') fecharModais();
        return true;
    }

    function wrapPlanner() {
        if (typeof window.planejarDia !== 'function' || window.planejarDia.__cycleRulesV265) return;
        const original = window.planejarDia;
        window.planejarDia = function wrappedPlanejarDia(state, date, limit, mutarEstado) {
            const planned = original.apply(this, arguments) || [];
            if (!appReady(state)) return planned;
            return planned.filter(task => !blockedByCycle(task, state));
        };
        window.planejarDia.__cycleRulesV265 = true;
    }

    function wrapTempoExtra() {
        if (typeof window.aplicarTempoExtraTeoria !== 'function' || window.aplicarTempoExtraTeoria.__cycleRulesV265) return;
        const original = window.aplicarTempoExtraTeoria;
        window.aplicarTempoExtraTeoria = function wrappedTempoExtra(destino) {
            const hours = Math.max(MIN_TASK_HOURS, parseFloat(document.getElementById('teoria-extra-horas')?.value) || 1);
            if (destino === 'semana' || destino === 'outro-dia' || destino === 'amanha') {
                if (addExtraStudyForAnotherDay(hours)) return;
            }
            const result = original.apply(this, arguments);
            if (filterInvalidScheduledTasks()) saveNow();
            return result;
        };
        window.aplicarTempoExtraTeoria.__cycleRulesV265 = true;
    }

    function boot() {
        installQuietToasts();
        wrapPlanner();
        wrapTempoExtra();
        if (filterInvalidScheduledTasks()) saveNow();
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
    setTimeout(boot, 800);
    setTimeout(boot, 2000);
})();
