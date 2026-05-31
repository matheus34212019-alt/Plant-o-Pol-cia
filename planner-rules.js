(function plantaoRulesPatch() {
    const STORAGE_KEY = 'prf_v120';
    const MIN_TASK_HOURS = 0.5;
    const MAX_HOURS_PER_MATTER_DAY = 2;

    const pad = n => String(n).padStart(2, '0');
    const roundHours = value => Math.round((parseFloat(value) || 0) * 10) / 10;
    const cleanDate = value => {
        const date = value instanceof Date ? new Date(value) : parseDateKey(value) || new Date(value || new Date());
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

    function parseDateKey(value) {
        if (!value || value instanceof Date) return value || null;
        const text = String(value);
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
        return null;
    }

    function normalizeDayKey(key) {
        return dateKey(parseDateKey(key) || key);
    }

    function appReady(state = getDb()) {
        return !!(state && Array.isArray(state.lista) && state.metaFixa && typeof state.metaFixa === 'object');
    }

    function installQuietToasts() {
        if (typeof window.showToast !== 'function') return;
        const original = window.showToast.__plantaoOriginalToast || window.showToast;
        window.showToast = function quietPlannerToast(title, message, type) {
            const text = `${title || ''} ${message || ''}`.toLowerCase();
            const automaticCorrection = /hora|horas|corrigid|cronograma|recalcul|replanejad|planejamento|tempo extra|dados sincronizados|progresso preservado|nuvem ativada|rotina|lançamentos recuperados|lancamentos recuperados/.test(text);
            if (automaticCorrection) return;
            return original.apply(this, arguments);
        };
        window.showToast.__plantaoOriginalToast = original;
        window.showToast.__quietPlannerV271 = true;
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

    function itemStudyOpen(item) {
        const total = parseFloat(item?.h?.E) || 0;
        const done = parseFloat(item?.hF) || 0;
        const extra = parseFloat(item?.extraTeoria) || 0;
        if (extra > 0.01) return true;
        if (done < total - 0.01) return true;
        return !(item?.f || item?.sinalizado || item?.cicloConcluidoManual);
    }

    function taskEntries(state = getDb()) {
        const entries = [];
        Object.entries(state?.metaFixa || {}).forEach(([key, tasks]) => {
            (tasks || []).forEach(task => entries.push({ key, normalizedKey: normalizeDayKey(key), task }));
        });
        return entries;
    }

    function matterInitialOpenForReview(task, state = getDb()) {
        if (!task || task.k === 'E' || isExtraTask(task) || isDone(task)) return null;
        return (state?.lista || [])
            .filter(item => item.m === task.m)
            .filter(itemStudyOpen)
            .sort((a, b) => orderOf(a, state) - orderOf(b, state))[0] || null;
    }

    function earlierOpenStudyItems(task, state = getDb()) {
        if (!task?.m || isExtraTask(task) || isDone(task)) return [];
        const taskItem = findItemForTask(task, state) || task;
        const taskOrder = orderOf(taskItem, state);
        return (state?.lista || [])
            .filter(item => item.m === task.m)
            .filter(item => !samePlannedItem(taskItem, item))
            .filter(item => orderOf(item, state) < taskOrder)
            .filter(itemStudyOpen);
    }

    function earliestScheduledDateForItem(item, state = getDb(), batchEntries = []) {
        const dates = taskEntries(state)
            .concat(batchEntries || [])
            .filter(entry => {
                const candidate = entry.task;
                return candidate && candidate.k === 'E' && isStudy(candidate) && !isExtraTask(candidate) && !isDone(candidate) && samePlannedItem(candidate, item);
            })
            .map(entry => entry.normalizedKey)
            .filter(Boolean)
            .sort();
        return dates[0] || null;
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

    function violatesSequentialStudyOrder(task, targetKey, state = getDb(), batchEntries = []) {
        if (!targetKey || !isStudy(task) || task?.k !== 'E') return false;
        const normalizedTarget = normalizeDayKey(targetKey);
        return earlierOpenStudyItems(task, state).some(item => {
            const scheduledKey = earliestScheduledDateForItem(item, state, batchEntries);
            return !scheduledKey || scheduledKey >= normalizedTarget;
        });
    }

    function violatesPreviousLessonDate(task, targetKey, state = getDb(), batchEntries = []) {
        if (!targetKey) return false;
        const normalizedTarget = normalizeDayKey(targetKey);
        return earlierPendingStudyEntries(task, state, batchEntries).some(entry => normalizedTarget <= entry.normalizedKey);
    }

    function sameItemTheoryPending(task, state = getDb()) {
        if (!task || task.k === 'E' || isExtraTask(task) || isDone(task)) return false;
        const item = findItemForTask(task, state);
        if (!item) return false;
        return itemStudyOpen(item);
    }

    function blockedByCycle(task, targetKey, state = getDb(), batchEntries = []) {
        if (!appReady(state) || !task || isDone(task) || isExtraTask(task)) return false;
        const openMatterStudy = matterInitialOpenForReview(task, state);
        if (openMatterStudy) return true;
        if (sameItemTheoryPending(task, state)) return true;
        if (violatesSequentialStudyOrder(task, targetKey, state, batchEntries)) return true;
        return violatesPreviousLessonDate(task, targetKey, state, batchEntries);
    }

    function saveNow() {
        const data = getDb();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {}
        if (typeof save === 'function') save();
    }

    function hasPendingExtraTask(item, state = getDb()) {
        return taskEntries(state).some(entry => entry.task?.extraStudy === true && !isDone(entry.task) && samePlannedItem(entry.task, item));
    }

    function normalizePartialStudyHours(state = getDb()) {
        if (!appReady(state)) return false;
        let changed = false;

        (state.lista || []).forEach(item => {
            const extra = roundHours(parseFloat(item.extraTeoria) || 0);
            let total = roundHours(parseFloat(item.h?.E) || 0);
            let done = roundHours(parseFloat(item.hF) || 0);
            if (extra <= 0.01 || total <= 0) return;

            const completedStudyTasks = taskEntries(state)
                .filter(entry => entry.task?.k === 'E' && !isExtraTask(entry.task) && isDone(entry.task) && samePlannedItem(entry.task, item));
            const maxCompletedCard = completedStudyTasks.reduce((max, entry) => Math.max(max, taskHours(entry.task)), 0);

            if (total >= done + extra - 0.01 && done > extra + 0.01 && Math.abs(maxCompletedCard - done) <= 0.01) {
                total = done;
                done = roundHours(Math.max(0, total - extra));
                item.h = item.h || {};
                item.h.E = total;
                item.hF = done;
                changed = true;
            }

            const studiedHours = roundHours(Math.max(0, total - extra));
            if ((parseFloat(item.hF) || 0) !== studiedHours || item.f || item.done?.E) {
                item.hF = studiedHours;
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

            completedStudyTasks.forEach((entry, index) => {
                const target = index === 0 ? studiedHours : taskHours(entry.task);
                if (Math.abs(taskHours(entry.task) - target) > 0.01) {
                    entry.task.h = target;
                    entry.task.hReal = target;
                    entry.task.tempoLancado = target;
                    changed = true;
                }
            });

            const remaining = roundHours(Math.max(0, (parseFloat(item.h?.E) || 0) - (parseFloat(item.hF) || 0)));
            if (remaining >= MIN_TASK_HOURS - 0.01 && !hasPendingExtraTask(item, state)) {
                placeTask(makeExtraStudyTask(completedStudyTasks[0]?.task || itemToTask(item), item, remaining, dateKey(getViewDate())), getViewDate());
                changed = true;
            }
        });
        return changed;
    }

    function filterInvalidScheduledTasks(state = getDb()) {
        if (!appReady(state)) return false;
        let changed = false;
        Object.keys(state.metaFixa || {}).sort((a, b) => normalizeDayKey(a).localeCompare(normalizeDayKey(b))).forEach(key => {
            const keptTasks = [];
            const keptEntries = [];
            (state.metaFixa[key] || []).forEach(task => {
                if (blockedByCycle(task, key, state, keptEntries)) {
                    changed = true;
                    return;
                }
                keptTasks.push(task);
                keptEntries.push({ key, normalizedKey: normalizeDayKey(key), task });
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
        const entries = taskEntries(data)
            .filter(entry => entry.task?.k === 'E' && !isExtraTask(entry.task) && isDone(entry.task) && samePlannedItem(entry.task, item));
        if (!entries.length) return;
        entries[0].task.h = roundHours(hours);
        entries[0].task.hReal = roundHours(hours);
        entries[0].task.tempoLancado = roundHours(hours);
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
        const a = normalizePartialStudyHours(data);
        const b = filterInvalidScheduledTasks(data);
        saveNow();

        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderLancamentos === 'function') renderLancamentos();
        if (typeof fecharModais === 'function') fecharModais();
        return a || b || true;
    }

    function runLightCorrections() {
        const changedHours = normalizePartialStudyHours();
        const changedCycle = filterInvalidScheduledTasks();
        if (changedHours || changedCycle) saveNow();
        return changedHours || changedCycle;
    }

    function wrapPlanner() {
        if (typeof window.planejarDia !== 'function' || window.planejarDia.__cycleRulesV271) return;
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
                    acceptedEntries.push({ key, normalizedKey: normalizeDayKey(key), task });
                }
            });
            return accepted;
        };
        window.planejarDia.__cycleRulesV271 = true;
    }

    function wrapTempoExtra() {
        if (typeof window.aplicarTempoExtraTeoria !== 'function' || window.aplicarTempoExtraTeoria.__cycleRulesV271) return;
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
        window.aplicarTempoExtraTeoria.__cycleRulesV271 = true;
    }

    function wrapRenderer(name) {
        if (typeof window[name] !== 'function' || window[name].__cycleRulesV271) return;
        const original = window[name];
        window[name] = function wrappedRenderer() {
            runLightCorrections();
            return original.apply(this, arguments);
        };
        window[name].__cycleRulesV271 = true;
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
