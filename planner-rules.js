(function plantaoRulesPatch() {
    const STORAGE_KEY = 'prf_v120';
    const MAX_STUDY_PER_DAY = 2;
    const pad = n => String(n).padStart(2, '0');
    const cleanDate = value => { const d = new Date(value || new Date()); d.setHours(0,0,0,0); return d; };
    const dateKey = value => { const d = cleanDate(value); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
    const addDays = (date, amount) => { const d = cleanDate(date); d.setDate(d.getDate() + amount); return d; };
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
    function setTaskHours(task, hours) { const h = Math.max(0.5, parseFloat(hours) || 0.5); task.h = h; task.hExtra = h; return task; }
    function dayCapacity(date) { const data = getDb(); return Math.max(0, parseFloat(data?.h?.[cleanDate(date).getDay()]) || 0); }
    function dayUsage(tasks) { return (tasks || []).filter(task => !isExtraTask(task)).reduce((sum, task) => sum + taskHours(task), 0); }
    function studyCount(tasks) { return (tasks || []).filter(task => !isExtraTask(task) && isStudy(task)).length; }
    function canFit(tasks, date, task) {
        if (isExtraTask(task) || isDone(task)) return true;
        if (dayCapacity(date) <= 0) return false;
        if (dayUsage(tasks) + taskHours(task) > dayCapacity(date)) return false;
        if (isStudy(task) && studyCount(tasks) >= MAX_STUDY_PER_DAY) return false;
        return true;
    }
    function subjectOrder(item) { return Number.isFinite(parseFloat(item?.ordem)) ? parseFloat(item.ordem) : 0; }
    function sameSubject(a, b) { return !!a && !!b && a.m === b.m && a.a === b.a; }
    function pendingExtraForMatter(materia) {
        const data = getDb();
        return Object.values(data?.metaFixa || {}).flat().find(task => task?.extraStudy === true && !isDone(task) && task.m === materia);
    }
    function sameMatterLaterTask(task, blocker) {
        if (!task || !blocker || task.m !== blocker.m || isExtraTask(task) || isDone(task) || sameSubject(task, blocker)) return false;
        const a = subjectOrder(task), b = subjectOrder(blocker);
        return a && b ? a > b : true;
    }
    function isBlockedByExtra(task) { const blocker = pendingExtraForMatter(task?.m); return !!blocker && sameMatterLaterTask(task, blocker); }
    function saveNow() { const data = getDb(); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {} if (typeof save === 'function') save(); }
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
            l: 'Estudo', k: 'E', c: false,
            extraStudy: true, tempoExtraPendente: true, origemTempoExtra: originDate || dateKey(new Date()),
            done: { ...(baseTask?.done || {}), E: false }, f: false
        }, hours);
    }
    function placeTask(task, startDate) {
        const data = getDb();
        for (let offset = 1; offset <= 365; offset++) {
            const date = addDays(startDate, offset), key = dateKey(date), tasks = data.metaFixa[key] || [];
            if (canFit(tasks, date, task)) { data.metaFixa[key] = tasks.concat(task); return key; }
        }
        const key = dateKey(addDays(startDate, 1)); data.metaFixa[key] = (data.metaFixa[key] || []).concat(task); return key;
    }
    function removeBlockedFutureAdvances() {
        const data = getDb(); if (!data?.metaFixa) return [];
        const removed = [];
        Object.keys(data.metaFixa).sort().forEach(key => {
            const kept = [];
            (data.metaFixa[key] || []).forEach(task => isBlockedByExtra(task) ? removed.push({ key, task }) : kept.push(task));
            if (kept.length) data.metaFixa[key] = kept; else delete data.metaFixa[key];
        });
        return removed;
    }
    function matterHasOpenInitialItem(materia) { const data = getDb(); return (data?.lista || []).some(item => item.m === materia && !item.f); }
    function candidateAllowed(task) {
        if (!task || isExtraTask(task) || isDone(task) || isBlockedByExtra(task) || !task.m || !task.a) return false;
        if (pendingExtraForMatter(task.m) && !task.extraStudy) return false;
        const data = getDb();
        if (typeof assuntoPodeEntrarNoCicloInicial === 'function') {
            const item = (data?.lista || []).find(x => x.m === task.m && x.a === task.a);
            if (item && !assuntoPodeEntrarNoCicloInicial(data, item)) return false;
        } else if (matterHasOpenInitialItem(task.m)) {
            const firstOpen = (data?.lista || []).filter(item => item.m === task.m && !item.f).sort((a,b) => subjectOrder(a) - subjectOrder(b))[0];
            if (firstOpen && firstOpen.a !== task.a) return false;
        }
        return true;
    }
    function refillDay(date) {
        const data = getDb(); if (!data?.metaFixa || typeof planejarDia !== 'function') return;
        const key = dateKey(date), remaining = Math.max(0, dayCapacity(date) - dayUsage(data.metaFixa[key] || []));
        if (remaining <= 0) return;
        (planejarDia(data, date, remaining, true) || []).forEach(task => {
            if (candidateAllowed(task) && canFit(data.metaFixa[key] || [], date, task)) data.metaFixa[key] = (data.metaFixa[key] || []).concat(task);
        });
    }
    function replaceBlockedActivities() { const removed = removeBlockedFutureAdvances(); [...new Set(removed.map(x => x.key))].forEach(key => refillDay(cleanDate(`${key}T00:00:00`))); return removed.length; }
    function getActiveTheoryTask() {
        if (typeof teoriaPendente !== 'undefined' && teoriaPendente?.item) return teoriaPendente.item;
        const tasks = getDb()?.metaFixa?.[dateKey(getViewDate())] || [];
        return tasks.find(task => !isDone(task) && isStudy(task));
    }
    function addExtraStudyForAnotherDay(hours) {
        const data = getDb(); if (!data) return false; data.metaFixa = data.metaFixa || {};
        const baseTask = getActiveTheoryTask(); if (!baseTask) return false;
        const today = getViewDate(); placeTask(makeExtraStudyTask(baseTask, hours, dateKey(today)), today);
        replaceBlockedActivities(); saveNow(); refresh(today);
        if (typeof showToast === 'function') showToast('Tempo extra replanejado', `${hours}h foi adicionada ao proximo dia disponivel e os avancos da materia foram bloqueados.`);
        return true;
    }
    function clampLaunchHours() {
        const data = getDb(); if (!data?.metaFixa) return;
        Object.values(data.metaFixa).flat().forEach(task => {
            if (!task || !isDone(task)) return;
            const real = task.hExtra || task.tempoLancado || task.hReal || task.hFeita;
            if (real && parseFloat(real) > 0) setTaskHours(task, real);
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
            clampLaunchHours(); replaceBlockedActivities(); saveNow(); refresh(getViewDate()); return result;
        };
        window.aplicarTempoExtraTeoria.__extraRulesWrapped = true;
    }
    function wrapRender(name) {
        if (typeof window[name] !== 'function' || window[name].__extraRulesWrapped) return;
        const original = window[name];
        window[name] = function wrappedRender() { replaceBlockedActivities(); clampLaunchHours(); return original.apply(this, arguments); };
        window[name].__extraRulesWrapped = true;
    }
    function boot() { wrapTempoExtra(); ['renderDiario','renderSemanal','renderLancamentos','updateDashboard'].forEach(wrapRender); replaceBlockedActivities(); clampLaunchHours(); }
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
    setTimeout(boot, 500); setTimeout(boot, 1500);
})();
