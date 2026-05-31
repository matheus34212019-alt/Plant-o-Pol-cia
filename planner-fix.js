(function plantaoPlannerFixLight() {
    window.__plantaoHotfixV195 = true;
    window.__plantaoPersistenceGuardV193 = true;
    window.__plantaoPartialStudyGuardV195 = true;
    window.__plantaoSafeTaskClickV195 = true;

    function extra(task) {
        return task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    }

    function roundHour(value) {
        return Math.round((parseFloat(value) || 0) * 10) / 10;
    }

    function sameTask(a, b) {
        const norm = value => String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
        if (a?.recoveryId && b?.recoveryId && a.recoveryId === b.recoveryId) return true;
        if (a?.itemId && b?.itemId && a.itemId === b.itemId && a.k === b.k) return true;
        return norm(a?.m) === norm(b?.m) && norm(a?.a) === norm(b?.a) && a?.k === b?.k;
    }

    function mergeCompletedWithoutInflating(base, completed) {
        const doneHours = roundHour(completed?.h);
        if (doneHours <= 0.01) return;
        const idx = base.findIndex(task => sameTask(task, completed));
        if (idx < 0) {
            base.push({ ...completed, h: doneHours, c: true });
            return;
        }
        const planned = base[idx];
        const plannedHours = roundHour(planned?.h);
        if (planned?.c || completed.k !== 'E' || plannedHours <= doneHours + 0.01) {
            base[idx] = { ...planned, ...completed, h: doneHours || plannedHours, c: true };
            return;
        }
        const completedChunk = { ...planned, ...completed, h: doneHours, c: true };
        const pendingChunk = { ...planned, h: roundHour(plannedHours - doneHours), c: false };
        delete pendingChunk.perf;
        base.splice(idx, 1, completedChunk, pendingChunk);
    }

    function installMergeGuard() {
        if (typeof mesclarLancamentosConcluidosNoDia === 'function' && !mesclarLancamentosConcluidosNoDia.__lightFixV273) {
            mesclarLancamentosConcluidosNoDia = function mesclarLancamentosSemInflarHoras(tasks, diaKey) {
                const base = (tasks || []).filter(task => !extra(task)).map(task => ({ ...task }));
                const completed = ((db?.metaFixa?.[diaKey] || []).filter(task => !extra(task) && task.c));
                completed.forEach(task => mergeCompletedWithoutInflating(base, task));
                return base;
            };
            mesclarLancamentosConcluidosNoDia.__lightFixV273 = true;
        }
    }

    function boot() {
        installMergeGuard();
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
    setTimeout(boot, 500);
})();
