(function plantaoRulesPatch() {
    const STORAGE_KEY = 'prf_v120';
    const MAX_STUDY_PER_DAY = 2;
    const MAX_HOURS_PER_MATTER_DAY = 2;
    const MIN_TASK_HOURS = 0.5;
    const FUTURE_REPLAN_DAYS = 21;

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
    const getViewDate = () => (typeof vDate !== 'undefined' ? cleanDate(vDate) : cleanDate(new Date()));
    const isExtraTask = task => task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    const isDone = task => task?.c === true;
    const isStudy = task => task?.k === 'E' || task?.l === 'Estudo' || !task?.k;

    function taskHours(task) {
        if (typeof task?.h === 'number') return Math.max(0.5, task.h || 1);
        if (task?.h && typeof task.h === 'object') return Math.max(0.5, parseFloat(task.h[task.k] || task.h.E || 1));
        return Math.max(0.5, parseFloat(task?.h) || 1);
    }

    function setTaskHours(task, hours) {
        const value = Math.max(0.5, parseFloat(hours) || 0.5);
        task.h = value;
        task.hExtra = value;
        return task;
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
        return (tasks || [])
            .filter(task => !isExtraTask(task) && task?.m === materia)
            .reduce((sum, task) => sum + taskHours(task), 0);
    }

    function canFit(tasks, date, task) {
        if (isExtraTask(task) || isDone(task)) return true;
        const capacity = dayCapacity(date);
        if (capacity <= 0) return false;
        if (dayUsage(tasks) + taskHours(task) > capacity) return false;
        if (task?.m && matterUsage(tasks, task.m) + taskHours(task) > MAX_HOURS_PER_MATTER_DAY + 0.01) return false;
        if (isStudy(task) && studyCount(tasks) >= MAX_STUDY_PER_DAY) return false;
        return true;
    }

    function sameSubject(a, b) {
        return !!a && !!b && a.m === b.m && a.a === b.a;
    }

    function subjectOrder(item) {
        return Number.isFinite(parseFloat(item?.ordem)) ? parseFloat(item.ordem) : 0;
    }

    function sameMatterLaterTask(task, blocker) {
        if (!task || !blocker || task.m !== blocker.m || isExtraTask(task) || isDone(task)) return false;
        if (sameSubject(task, blocker)) return false;
        const taskOrder = subjectOrder(task);
        const blockerOrder = subjectOrder(blocker);
        if (taskOrder && blockerOrder) return taskOrder > blockerOrder;
        return true;
    }

    function pendingExtraForMatter(materia) {
        const data = getDb();
        const tasks = Object.values(data?.metaFixa || {}).flat();
        return tasks.find(task => task?.extraStudy === true && !isDone(task) && task.m === materia);
    }

    function isBlockedByExtra(task) {
        const blocker = pendingExtraForMatter(task?.m);
        return !!blocker && sameMatterLaterTask(task, blocker);
    }

    function saveNow() {
        const data = getDb();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {}
        if (typeof save === 'function') save();
    }

    function refresh(date = getViewDate()) {
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(date);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderLancamentos === 'function') renderLancamentos();
    }

    function makeExtraStudyTask(baseTask, hours, originDate) {
        return setTaskHours({
            ...baseTask,
            id: `${baseTask?.id || 'extra'}-tempo-extra-${Date.now()}`,
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

    function removeBlockedFutureAdvances() {
        const data = getDb();
        if (!data?.metaFixa) return [];
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

    function matterHasOpenInitialItem(materia) {
        const data = getDb();
        return (data?.lista || []).some(item => item.m === materia && !item.f);
    }

    function candidateAllowed(task) {
        if (!task || isExtraTask(task) || isDone(task) || isBlockedByExtra(task)) return false;
        if (!task.m || !task.a) return false;
        if (pendingExtraForMatter(task.m) && !task.extraStudy) return false;
        if (typeof assuntoPodeEntrarNoCicloInicial === 'function') {
            const data = getDb();
            const item = (data?.lista || []).find(x => x.m === task.m && x.a === task.a);
            if (item && !assuntoPodeEntrarNoCicloInicial(data, item)) return false;
        } else if (matterHasOpenInitialItem(task.m)) {
            const data = getDb();
            const firstOpen = (data?.lista || [])
                .filter(item => item.m === task.m && !item.f)
                .sort((a, b) => subjectOrder(a) - subjectOrder(b))[0];
            if (firstOpen && firstOpen.a !== task.a) return false;
        }
        return true;
    }

    function roundHours(value) {
        return Math.round((parseFloat(value) || 0) * 10) / 10;
    }

    function balanceDayPlan(tasks, date) {
        const capacity = dayCapacity(date);
        if (!Array.isArray(tasks) || capacity <= 0) return tasks || [];
        const extras = tasks.filter(isExtraTask);
        const planned = tasks.filter(task => !isExtraTask(task));
        const result = [];
        const byMatter = {};
        let total = 0;

        const addTask = (task, forceDone = false) => {
            const hours = taskHours(task);
            const matter = task?.m || '';
            const usedMatter = byMatter[matter] || 0;
            const roomDay = Math.max(0, capacity - total);
            const roomMatter = matter ? Math.max(0, MAX_HOURS_PER_MATTER_DAY - usedMatter) : roomDay;
            const allowed = forceDone ? hours : Math.min(hours, roomDay, roomMatter);
            if (!forceDone && allowed < MIN_TASK_HOURS - 0.01) return false;
            const copy = {...task, h: roundHours(allowed)};
            result.push(copy);
            total += taskHours(copy);
            if (matter) byMatter[matter] = (byMatter[matter] || 0) + taskHours(copy);
            return true;
        };

        planned.filter(isDone).forEach(task => addTask(task, true));
        planned.filter(task => !isDone(task)).forEach(task => addTask(task, false));
        return [...result, ...extras];
    }

    function balanceExistingDay(key) {
        const data = getDb();
        if (!data?.metaFixa?.[key]) return false;
        const date = cleanDate(`${key}T00:00:00`);
        const before = JSON.stringify(data.metaFixa[key]);
        data.metaFixa[key] = balanceDayPlan(data.metaFixa[key], date);
        return JSON.stringify(data.metaFixa[key]) !== before;
    }

    function balanceExistingPlans() {
        const data = getDb();
        if (!data?.metaFixa) return false;
        let changed = false;
        Object.keys(data.metaFixa).sort().forEach(key => {
            if (balanceExistingDay(key)) {
                refillDay(cleanDate(`${key}T00:00:00`));
                balanceExistingDay(key);
                changed = true;
            }
        });
        return changed;
    }

    function refillDay(date) {
        const data = getDb();
        if (!data?.metaFixa || typeof planejarDia !== 'function') return;
        const key = dateKey(date);
        const tasks = data.metaFixa[key] || [];
        const remaining = Math.max(0, dayCapacity(date) - dayUsage(tasks));
        if (remaining <= 0) return;
        const planned = planejarDia(data, date, remaining, true) || [];
        planned.forEach(task => {
            if (canFit(data.metaFixa[key] || [], date, task) && candidateAllowed(task)) {
                data.metaFixa[key] = (data.metaFixa[key] || []).concat(task);
            }
        });
    }

    function replaceBlockedActivities() {
        const removed = removeBlockedFutureAdvances();
        const uniqueDays = [...new Set(removed.map(item => item.key))].sort();
        uniqueDays.forEach(key => refillDay(cleanDate(`${key}T00:00:00`)));
        balanceExistingPlans();
        return removed.length;
    }

    function replanFutureDays(startDate = addDays(getViewDate(), 1), days = FUTURE_REPLAN_DAYS) {
        const data = getDb();
        if (!data?.metaFixa || typeof planejarDia !== 'function') return false;
        let changed = false;

        for (let offset = 0; offset < days; offset++) {
            const date = addDays(startDate, offset);
            const key = dateKey(date);
            const current = data.metaFixa[key] || [];
            const keep = current.filter(task => isDone(task) || isExtraTask(task));
            if (JSON.stringify(current) !== JSON.stringify(keep)) changed = true;
            data.metaFixa[key] = keep;

            const remaining = Math.max(0, dayCapacity(date) - dayUsage(data.metaFixa[key]));
            if (remaining > 0.01) {
                const planned = planejarDia(data, date, remaining, true) || [];
                planned.forEach(task => {
                    if (candidateAllowed(task) && canFit(data.metaFixa[key] || [], date, task)) {
                        data.metaFixa[key] = (data.metaFixa[key] || []).concat(task);
                        changed = true;
                    }
                });
            }

            balanceExistingDay(key);
            if (!data.metaFixa[key]?.length) delete data.metaFixa[key];
        }

        return changed;
    }

    function wrapPlanner() {
        if (typeof window.planejarDia !== 'function' || window.planejarDia.__balanceRulesWrapped) return;
        const original = window.planejarDia;
        window.planejarDia = function wrappedPlanejarDia(state, date, limit, mutarEstado) {
            const planned = original.apply(this, arguments) || [];
            return balanceDayPlan(planned, date);
        };
        window.planejarDia.__balanceRulesWrapped = true;
    }

    function getActiveTheoryTask() {
        if (typeof teoriaPendente !== 'undefined' && teoriaPendente?.item) return teoriaPendente.item;
        const data = getDb();
        const todayTasks = data?.metaFixa?.[dateKey(getViewDate())] || [];
        return todayTasks.find(task => !isDone(task) && isStudy(task));
    }

    function addExtraStudyForAnotherDay(hours) {
        const data = getDb();
        if (!data) return false;
        data.metaFixa = data.metaFixa || {};
        const baseTask = getActiveTheoryTask();
        if (!baseTask) return false;
        const today = getViewDate();
        const extraTask = makeExtraStudyTask(baseTask, hours, dateKey(today));
        placeTask(extraTask, today);
        replaceBlockedActivities();
        replanFutureDays(addDays(today, 1));
        saveNow();
        refresh(today);
        if (typeof showToast === 'function') {
            showToast('Tempo extra replanejado', `${hours}h foi adicionada ao proximo dia disponivel e os avancos da materia foram bloqueados.`);
        }
        return true;
    }

    function clampLaunchHours() {
        const data = getDb();
        if (!data?.metaFixa) return;
        Object.values(data.metaFixa).flat().forEach(task => {
            if (!task || !isDone(task)) return;
            const real = task.hExtra || task.tempoLancado || task.hReal || task.hFeita;
            if (real && parseFloat(real) > 0) setTaskHours(task, real);
            if (task.extraStudy && taskHours(task) > (parseFloat(task.hExtra) || taskHours(task))) {
                setTaskHours(task, task.hExtra);
            }
        });
    }

    function wrapTempoExtra() {
        if (typeof window.aplicarTempoExtraTeoria !== 'function' || window.aplicarTempoExtraTeoria.__extraRulesWrapped) return;
        const original = window.aplicarTempoExtraTeoria;
        window.aplicarTempoExtraTeoria = function wrappedTempoExtra(destino) {
            const hours = Math.max(0.5, parseFloat(document.getElementById('teoria-extra-horas')?.value) || 1);
            if (destino === 'semana' || destino === 'outro-dia' || destino === 'amanha') {
                if (addExtraStudyForAnotherDay(hours)) return;
            }
            const result = original.apply(this, arguments);
            clampLaunchHours();
            replaceBlockedActivities();
            saveNow();
            refresh(getViewDate());
            return result;
        };
        window.aplicarTempoExtraTeoria.__extraRulesWrapped = true;
    }

    function wrapRender(name) {
        if (typeof window[name] !== 'function' || window[name].__extraRulesWrapped) return;
        const original = window[name];
        window[name] = function wrappedRender() {
            replaceBlockedActivities();
            clampLaunchHours();
            const result = original.apply(this, arguments);
            return result;
        };
        window[name].__extraRulesWrapped = true;
    }

    function boot() {
        wrapPlanner();
        wrapTempoExtra();
        ['renderDiario', 'renderSemanal', 'renderLancamentos', 'updateDashboard'].forEach(wrapRender);
        replaceBlockedActivities();
        replanFutureDays();
        clampLaunchHours();
        if (balanceExistingPlans()) saveNow();
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
    setTimeout(boot, 500);
    setTimeout(boot, 1500);
})();
