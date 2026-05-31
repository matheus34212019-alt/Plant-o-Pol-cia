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
        if (typeof window.showToast !== 'function') return;
        const original = window.showToast.__plantaoOriginalToast || window.showToast;
        window.showToast = function quietPlannerToast(title, message, type) {
            const text = `${title || ''} ${message || ''}`.toLowerCase();
            const automaticCorrection = /hora|horas|corrigid|cronograma|recalcul|replanejad|planejamento|tempo extra|dados sincronizados|progresso preservado|nuvem ativada|rotina/.test(text);
            if (automaticCorrection) return;
            return original.apply(this, arguments);
        };
        window.showToast.__plantaoOriginalToast = original;
        window.showToast.__quietPlannerV268 = true;
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

    function taskEntries(state = getDb()) {
        const entries = [];
        Object.entries(state?.metaFixa || {}).forEach(([key, tasks]) => {
            (tasks || []).forEach(task => entries.push({ key, task }));
        });
        return entries;
    }

    function earlierPendingStudyEntries(task, state = getDb(), batchEntries = []) {
        if (!task?.m || isExtraTask(task) || isDone(task)) return [];
        const taskOrder = orderOf(task, state);
        return taskEntries(state)
            .concat(batchEntries || [])
            .filter(entry => {
                const candidate = entry.task;
                if (!candidate || candidate.m !== task.m || candidate.k !== 'E' || !isStudy(candidate) || isExtraTask(candidate) || isDone(candidate)) return false;
                if (samePlannedItem(candidate, findItemForTask(task, state) || task)) return false;
                return orderOf(candidate, state) < taskOrder;
            });
    }

    function violatesPreviousLessonDate(task, targetKey, state = getDb(), batchEntries = []) {
        if (!targetKey) return false;
        return earlierPendingStudyEntries(task, state, batchEntries).some(entry => targetKey <= entry.key);
    }

    function sameItemTheoryPending(task, state = getDb()) {
        if (!task || task.k === 'E' || isExtraTask(task) || isDone(task)) return false;
        const item = findItemForTask(task, state);
        if (!item) return false;
        const total = parseFloat(item.h?.E) || 0;
        const done = parseFloat(item.hF) || 0;
        const extra = parseFloat(item.extraTeoria) || 0;
        return extra > 0.01 || done < total - 0.01;
    }

    function blockedByCycle(task, targetKey, state = getDb(), batchEntries = []) {
        if (!appReady(state) || !task || isDone(task) || isExtraTask(task)) return false;
        if (sameItemTheoryPending(task, state)) return true;
        return violatesPreviousLessonDate(task, targetKey, state, batchEntries);
    }

    function saveNow() {
        const data = getDb();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {}
        if (typeof save === 'function') save();
    }

    function normalizePartialStudyHours(state = getDb()) {
        if (!appReady(state)) return false;
        let changed = false;
        (state.lista || []).forEach(item => {
            const extra = roundHours(parseFloat(item.extraTeoria) || 0);
            const total = roundHours(parseFloat(item.h?.E) || 0);
            if (extra <= 0.01 || total <= 0) return;

            const studiedToday = roundHours(Math.max(0, total - extra));
            if ((parseFloat(item.hF) || 0) > studiedToday + 0.01 || item.f || item.done?.E) {
                item.hF = studiedToday;
                item.f = false;
                item.sinalizado = false;
                item.cicloConcluidoManual = false;
                item.done = item.done || {E:false, Rev:false, Ex:false};
                item.done.E = false;
                item.done.Rev = false;
                item.done.Ex = false;
                item.revCycle = null;
                item.extraTeoriaSaldoCorrigido = true;
                changed = true;
            }

            taskEntries(state)
                .filter(entry => entry.task?.k === 'E' && !isExtraTask(entry.task) && isDone(entry.task) && samePlannedItem(entry.task, item))
                .forEach(entry => {
                    const task = entry.task;
                    if (Math.abs(taskHours(task) - studiedToday) > 0.01) {
                        task.h = studiedToday;
                        task.hReal = studiedToday;
                        task.tempoLancado = studiedToday;
                        changed = true;
                    }
                });
        });
        return changed;
    }

    function filterInvalidScheduledTasks(state = getDb()) {
        if (!appReady(state)) return false;
        let changed = false;
        Object.keys(state.metaFixa || {}).sort().forEach(key => {
            const keptTasks = [];
            const keptEntries = [];
            (state.metaFixa[key] || []).forEach(task => {
                if (blockedByCycle(task, key, state, keptEntries)) {
                    changed = true;
                    return;
                }
                keptTasks.push(task);
                keptEntries.push({ key, task });
            });
            if (keptTasks.length) state.metaFixa[key] = keptTasks;
            else delete state.metaFixa[key];
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
            if (!blockedByCycle(task, key, data) && canFit(tasks, targetDate, task)) {
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

    function markItemPending(item, totalHours, extraHours, studiedHours) {
        item.h = item.h || {};
        item.h.E = roundHours(totalHours);
        item.hF = roundHours(studiedHours);
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
        taskEntries(data)
            .filter(entry => entry.task?.k === 'E' && !isExtraTask(entry.task) && isDone(entry.task) && samePlannedItem(entry.task, item))
            .forEach(entry => {
                entry.task.h = roundHours(hours);
                entry.task.hReal = roundHours(hours);
                entry.task.tempoLancado = roundHours(hours);
            });
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
        const studiedHours = roundHours(Math.max(0, totalBefore - nextExtra));

        markItemPending(item, totalBefore, nextExtra, studiedHours);
        setCompletedStudyCard(item, studiedHours);
        placeTask(makeExtraStudyTask(baseTask, item, extraHours, dateKey(today)), today);
        normalizePartialStudyHours(data);
        filterInvalidScheduledTasks(data);
        saveNow();

        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderLancamentos === 'function') renderLancamentos();
        if (typeof fecharModais === 'function') fecharModais();
        return true;
    }

    function runLightCorrections() {
        const changed = normalizePartialStudyHours() || filterInvalidScheduledTasks();
        if (changed) saveNow();
        return changed;
    }

    function wrapPlanner() {
        if (typeof window.planejarDia !== 'function' || window.planejarDia.__cycleRulesV268) return;
        const original = window.planejarDia;
        window.planejarDia = function wrappedPlanejarDia(state, date, limit, mutarEstado) {
            const planned = original.apply(this, arguments) || [];
            if (!appReady(state)) return planned;
            const key = dateKey(date);
            const accepted = [];
            const acceptedEntries = [];
            planned.forEach(task => {
                if (!blockedByCycle(task, key, state, acceptedEntries)) {
                    accepted.push(task);
                    acceptedEntries.push({ key, task });
                }
            });
            return accepted;
        };
        window.planejarDia.__cycleRulesV268 = true;
    }

    function wrapTempoExtra() {
        if (typeof window.aplicarTempoExtraTeoria !== 'function' || window.aplicarTempoExtraTeoria.__cycleRulesV268) return;
        const original = window.aplicarTempoExtraTeoria;
        window.aplicarTempoExtraTeoria = function wrappedTempoExtra(destino) {
            const hours = Math.max(MIN_TASK_HOURS, parseFloat(document.getElementById('teoria-extra-horas')?.value) || 1);
            if (destino === 'semana' || destino === 'outro-dia' || destino === 'amanha') {
                if (addExtraStudyForAnotherDay(hours)) return;
            }
            const result = original.apply(this, arguments);
            runLightCorrections();
            return result;
        };
        window.aplicarTempoExtraTeoria.__cycleRulesV268 = true;
    }

    function wrapRenderer(name) {
        if (typeof window[name] !== 'function' || window[name].__cycleRulesV268) return;
        const original = window[name];
        window[name] = function wrappedRenderer() {
            runLightCorrections();
            return original.apply(this, arguments);
        };
        window[name].__cycleRulesV268 = true;
    }

    function boot() {
        installQuietToasts();
        wrapPlanner();
        wrapTempoExtra();
        ['renderDiario', 'renderSemanal', 'renderLancamentos', 'updateDashboard'].forEach(wrapRenderer);
        runLightCorrections();
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
    setTimeout(boot, 800);
    setTimeout(boot, 2000);
})();
