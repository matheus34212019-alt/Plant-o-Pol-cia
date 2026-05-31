(function plantaoRulesPatch() {
    const STORAGE_KEY = 'prf_v120';
    const MIN_TASK_HOURS = 0.5;
    const MAX_STUDY_PER_DAY = 2;
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
    const isDone = task => task?.c === true;
    const isExtraTask = task => task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    const isStudy = task => task?.k === 'E' || task?.l === 'Estudo' || !task?.k;

    function appReady() {
        const data = getDb();
        return !!(data && Array.isArray(data.lista) && data.metaFixa && typeof window.planejarDia === 'function');
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

    function getViewDate() {
        return typeof vDate !== 'undefined' ? cleanDate(vDate) : cleanDate(new Date());
    }

    function samePlannedItem(task, item) {
        if (!task || !item) return false;
        if (task.itemId && item.id && task.itemId === item.id) return true;
        if (task.id && item.id && task.id === item.id) return true;
        return task.m === item.m && task.a === item.a;
    }

    function findItemForTask(task) {
        const data = getDb();
        return (data?.lista || []).find(item => samePlannedItem(task, item)) || null;
    }

    function itemToTask(item) {
        return { id: item?.id, itemId: item?.id, m: item?.m, a: item?.a, ordem: item?.ordem, l: 'Estudo', k: 'E', c: false };
    }

    function allPlannedTasks() {
        const data = getDb();
        const entries = [];
        Object.entries(data?.metaFixa || {}).forEach(([key, tasks]) => (tasks || []).forEach(task => entries.push({ key, task })));
        return entries;
    }

    function subjectOrder(entry) {
        const direct = parseFloat(entry?.ordem);
        if (Number.isFinite(direct)) return direct;
        const item = findItemForTask(entry) || entry;
        const fromItem = parseFloat(item?.ordem);
        return Number.isFinite(fromItem) ? fromItem : 0;
    }

    function sameMatterLaterTask(task, blocker) {
        if (!task || !blocker || task.m !== blocker.m || isExtraTask(task) || isDone(task)) return false;
        if (task.a === blocker.a) return false;
        const taskOrder = subjectOrder(task);
        const blockerOrder = subjectOrder(blocker);
        if (taskOrder && blockerOrder) return taskOrder > blockerOrder;
        return true;
    }

    function normalStudyTasksForItem(item) {
        return allPlannedTasks().filter(entry => entry.task?.k === 'E' && !isExtraTask(entry.task) && samePlannedItem(entry.task, item));
    }

    function pendingExtraTasksForItem(item) {
        return allPlannedTasks().filter(entry => entry.task?.extraStudy === true && !isDone(entry.task) && samePlannedItem(entry.task, item));
    }

    function pendingExtraForMatter(materia) {
        const data = getDb();
        const taskBlocker = allPlannedTasks().find(entry => entry.task?.extraStudy === true && !isDone(entry.task) && entry.task.m === materia);
        if (taskBlocker) return taskBlocker.task;
        return (data?.lista || []).find(item => item?.m === materia && (parseFloat(item.extraTeoria) || 0) > 0.01 && (parseFloat(item.hF) || 0) < (parseFloat(item.h?.E) || 0) - 0.01) || null;
    }

    function isBlockedByExtra(task) {
        const blocker = pendingExtraForMatter(task?.m);
        return !!blocker && sameMatterLaterTask(task, blocker);
    }

    function dayCapacity(date) {
        const data = getDb();
        return Math.max(0, parseFloat(data?.h?.[cleanDate(date).getDay()]) || 0);
    }

    function dayUsage(tasks) {
        return (tasks || []).filter(task => !isExtraTask(task)).reduce((sum, task) => sum + taskHours(task), 0);
    }

    function studyCount(tasks) {
        return (tasks || []).filter(task => !isExtraTask(task) && isStudy(task)).length;
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
        if (isStudy(task) && studyCount(tasks) >= MAX_STUDY_PER_DAY) return false;
        return true;
    }

    function saveNow() {
        const data = getDb();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {}
        if (typeof save === 'function') save();
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
            done: { ...(baseTask?.done || {}), E: false },
            f: false
        }, hours);
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

    function setCompletedStudyCardsToActual(item, actualHours) {
        let changed = false;
        const doneTasks = normalStudyTasksForItem(item).filter(entry => isDone(entry.task));
        doneTasks.forEach((entry, index) => {
            const target = index === 0 ? roundHours(actualHours) : taskHours(entry.task);
            if (Math.abs(taskHours(entry.task) - target) > 0.01) {
                entry.task.h = target;
                entry.task.hReal = target;
                entry.task.tempoLancado = target;
                changed = true;
            }
        });
        return changed;
    }

    function markItemPending(item, totalHours, extraHours, actualStudied) {
        if (!item) return false;
        const before = JSON.stringify(item);
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
        return JSON.stringify(item) !== before;
    }

    function ensurePendingExtraTask(item, startDate = getViewDate()) {
        const remaining = roundHours(Math.max(0, (parseFloat(item?.h?.E) || 0) - (parseFloat(item?.hF) || 0)));
        if (remaining < MIN_TASK_HOURS - 0.01 || pendingExtraTasksForItem(item).length) return false;
        const baseTask = normalStudyTasksForItem(item)[0]?.task || itemToTask(item);
        placeTask(makeExtraStudyTask(baseTask, item, remaining, dateKey(startDate)), startDate);
        return true;
    }

    function normalizeExtraStudyState() {
        if (!appReady()) return false;
        const data = getDb();
        let changed = false;
        data.lista.forEach(item => {
            const extra = roundHours(parseFloat(item?.extraTeoria) || 0);
            const total = roundHours(parseFloat(item?.h?.E) || 0);
            if (extra <= 0.01 || total <= extra + 0.01) return;
            if (item.extraTeoriaSaldoCorrigido !== true) {
                const legacyTotalBeforeExtra = roundHours(total - extra);
                const actualStudied = roundHours(Math.max(0, legacyTotalBeforeExtra - extra));
                const doneLooksInflated = (parseFloat(item.hF) || 0) >= legacyTotalBeforeExtra - 0.01 || normalStudyTasksForItem(item).some(entry => isDone(entry.task) && taskHours(entry.task) >= legacyTotalBeforeExtra - 0.01);
                if (legacyTotalBeforeExtra > extra + 0.01 && doneLooksInflated) {
                    changed = markItemPending(item, legacyTotalBeforeExtra, extra, actualStudied) || changed;
                    changed = setCompletedStudyCardsToActual(item, actualStudied) || changed;
                }
            }
            if ((parseFloat(item.extraTeoria) || 0) > 0.01 && (parseFloat(item.hF) || 0) < (parseFloat(item.h?.E) || 0) - 0.01) {
                changed = ensurePendingExtraTask(item) || changed;
            }
        });
        return changed;
    }

    function removeBlockedFutureAdvances() {
        const data = getDb();
        if (!appReady()) return [];
        const removed = [];
        Object.keys(data.metaFixa).sort().forEach(key => {
            const kept = [];
            (data.metaFixa[key] || []).forEach(task => {
                if (isBlockedByExtra(task)) removed.push({ key, task });
                else kept.push(task);
            });
            if (kept.length) data.metaFixa[key] = kept;
            else delete data.metaFixa[key];
        });
        return removed;
    }

    function candidateAllowed(task) {
        if (!appReady()) return true;
        if (!task || isExtraTask(task) || isDone(task) || isBlockedByExtra(task)) return false;
        if (!task.m || !task.a) return false;
        if (pendingExtraForMatter(task.m) && !task.extraStudy) return false;
        if (typeof assuntoPodeEntrarNoCicloInicial === 'function') {
            const data = getDb();
            const item = (data?.lista || []).find(x => samePlannedItem(task, x));
            if (item && !assuntoPodeEntrarNoCicloInicial(data, item)) return false;
        }
        return true;
    }

    function refillDay(date) {
        if (!appReady()) return;
        const data = getDb();
        const key = dateKey(date);
        const remaining = Math.max(0, dayCapacity(date) - dayUsage(data.metaFixa[key] || []));
        if (remaining <= 0.01) return;
        (planejarDia(data, date, remaining, true) || []).forEach(task => {
            if (candidateAllowed(task) && canFit(data.metaFixa[key] || [], date, task)) {
                data.metaFixa[key] = (data.metaFixa[key] || []).concat(task);
            }
        });
    }

    function replaceBlockedActivities() {
        const removed = removeBlockedFutureAdvances();
        [...new Set(removed.map(item => item.key))].sort().forEach(key => refillDay(cleanDate(`${key}T00:00:00`)));
        return removed.length > 0;
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
        if (!appReady()) return false;
        const data = getDb();
        data.metaFixa = data.metaFixa || {};
        const baseTask = getPendingTheoryTask();
        const item = findItemForTask(baseTask);
        if (!baseTask || !item) return false;
        const today = getViewDate();
        const extraHours = Math.max(MIN_TASK_HOURS, parseFloat(hours) || 0);
        const totalBefore = roundHours(parseFloat(item.h?.E) || taskHours(baseTask));
        const previousExtra = roundHours(parseFloat(item.extraTeoria) || 0);
        const nextExtra = roundHours(previousExtra + extraHours);
        const actualStudied = roundHours(Math.max(0, totalBefore - nextExtra));
        markItemPending(item, totalBefore, nextExtra, actualStudied);
        setCompletedStudyCardsToActual(item, actualStudied);
        placeTask(makeExtraStudyTask(baseTask, item, extraHours, dateKey(today)), today);
        normalizeExtraStudyState();
        replaceBlockedActivities();
        saveNow();
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderLancamentos === 'function') renderLancamentos();
        if (typeof fecharModais === 'function') fecharModais();
        if (typeof showToast === 'function') showToast('Tempo extra replanejado', `${roundHours(extraHours)}h ficou como saldo pendente.`);
        return true;
    }

    function wrapTempoExtra() {
        if (typeof window.aplicarTempoExtraTeoria !== 'function' || window.aplicarTempoExtraTeoria.__extraRulesWrapped) return;
        const original = window.aplicarTempoExtraTeoria;
        window.aplicarTempoExtraTeoria = function wrappedTempoExtra(destino) {
            const hours = Math.max(MIN_TASK_HOURS, parseFloat(document.getElementById('teoria-extra-horas')?.value) || 1);
            if (destino === 'semana' || destino === 'outro-dia' || destino === 'amanha') {
                if (addExtraStudyForAnotherDay(hours)) return;
            }
            const result = original.apply(this, arguments);
            if (appReady()) {
                normalizeExtraStudyState();
                replaceBlockedActivities();
                saveNow();
            }
            return result;
        };
        window.aplicarTempoExtraTeoria.__extraRulesWrapped = true;
    }

    function boot() {
        wrapTempoExtra();
        if (appReady()) {
            const changed = normalizeExtraStudyState() || replaceBlockedActivities();
            if (changed) saveNow();
        }
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
    setTimeout(boot, 800);
    setTimeout(boot, 2000);
})();
