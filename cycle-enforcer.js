(function plantaoCycleEnforcer() {
    if (window.__plantaoCycleEnforcerV275) return;
    window.__plantaoCycleEnforcerV275 = true;

    function value(name, fallback = null) {
        try { return Function(`return typeof ${name} === "undefined" ? null : ${name};`)() ?? fallback; }
        catch (_) { return window[name] ?? fallback; }
    }

    function setValue(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch (_) {}
        try { window[name] = replacement; } catch (_) {}
    }

    function fn(name) {
        const found = value(name);
        return typeof found === 'function' ? found : null;
    }

    function dbRef() {
        return value('db');
    }

    function norm(input) {
        return String(input || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/gi, ' ')
            .trim()
            .toUpperCase();
    }

    function sameMatter(a, b) {
        return norm(a) === norm(b);
    }

    function sameItem(task, item) {
        if (!task || !item) return false;
        if (task.itemId && item.id && task.itemId === item.id) return true;
        if (task.id && item.id && task.id === item.id) return true;
        return sameMatter(task.m, item.m) && norm(task.a) === norm(item.a);
    }

    function findItem(state, task) {
        return (state?.lista || []).find(item => sameItem(task, item)) || null;
    }

    function theoryOpen(item) {
        if (!item) return false;
        const total = parseFloat(item.h?.E) || 0;
        const done = parseFloat(item.hF) || 0;
        const extra = parseFloat(item.extraTeoria) || parseFloat(item.extraPendente) || parseFloat(item.tempoExtraPendente) || 0;
        if (extra > 0.01) return true;
        if (done < total - 0.01) return true;
        return !item.f;
    }

    function matterHasInitialOpen(state, materia) {
        return (state?.lista || []).some(item => sameMatter(item.m, materia) && theoryOpen(item));
    }

    function firstInitialOpenItem(state, materia) {
        return (state?.lista || [])
            .filter(item => sameMatter(item.m, materia))
            .filter(item => !item.f || (parseFloat(item.extraTeoria) || 0) > 0.01 || (parseFloat(item.hF) || 0) < (parseFloat(item.h?.E) || 0) - 0.01)
            .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))[0] || null;
    }

    function blockedTask(state, task) {
        if (!task || task.c || task.extra === true || task.l === 'Extra' || task.k === 'Extra') return false;
        const item = findItem(state, task);
        const hasInitialOpen = matterHasInitialOpen(state, task.m);

        if (task.k !== 'E' && hasInitialOpen) return true;
        if (item?.f && hasInitialOpen) return true;
        if (item && task.k !== 'E' && theoryOpen(item)) return true;
        return false;
    }

    function filterTasks(tasks, state) {
        return (tasks || []).filter(task => !blockedTask(state, task));
    }

    function filterAllDays() {
        const state = dbRef();
        if (!state?.metaFixa || !Array.isArray(state.lista)) return false;
        let changed = false;
        Object.keys(state.metaFixa).forEach(day => {
            const original = state.metaFixa[day] || [];
            const filtered = filterTasks(original, state);
            if (filtered.length !== original.length) {
                state.metaFixa[day] = filtered;
                changed = true;
            }
        });
        if (changed) {
            try { localStorage.setItem('prf_v120', JSON.stringify(state)); } catch (_) {}
        }
        return changed;
    }

    function installInitialCycleGate() {
        const original = fn('assuntoPodeEntrarNoCicloInicial');
        if (original?.__cycleEnforcerV275) return;

        function assuntoPodeEntrarNoCicloInicialEstrito(state, item) {
            if (!state || !item) return false;
            const extra = (parseFloat(item.extraTeoria) || 0) > 0.01;
            if (extra) return true;

            if (item.f) {
                return !matterHasInitialOpen(state, item.m);
            }

            const firstOpen = firstInitialOpenItem(state, item.m);
            return firstOpen?.id === item.id;
        }
        assuntoPodeEntrarNoCicloInicialEstrito.__cycleEnforcerV275 = true;
        assuntoPodeEntrarNoCicloInicialEstrito.__original = original;
        setValue('assuntoPodeEntrarNoCicloInicial', assuntoPodeEntrarNoCicloInicialEstrito);
    }

    function installBlockedFilter() {
        const original = fn('filtrarTarefasBloqueadasPorAulaAnterior');
        if (original?.__cycleEnforcerV275) return;

        function filtrarTarefasComCicloEstrito(tasks, state) {
            const base = original ? original.apply(this, arguments) : (tasks || []);
            return filterTasks(base, state || dbRef());
        }
        filtrarTarefasComCicloEstrito.__cycleEnforcerV275 = true;
        filtrarTarefasComCicloEstrito.__original = original;
        setValue('filtrarTarefasBloqueadasPorAulaAnterior', filtrarTarefasComCicloEstrito);
    }

    function installPlannerFilter() {
        const original = fn('planejarDia');
        if (!original || original.__cycleEnforcerV275) return;

        function planejarDiaComCicloEstrito(state, date, limit, mutarEstado) {
            const planned = original.apply(this, arguments) || [];
            return filterTasks(planned, state || dbRef());
        }
        planejarDiaComCicloEstrito.__cycleEnforcerV275 = true;
        planejarDiaComCicloEstrito.__original = original;
        setValue('planejarDia', planejarDiaComCicloEstrito);
    }

    function installRenderFilters() {
        ['renderSemanal', 'renderDiario', 'updateDashboard'].forEach(name => {
            const original = fn(name);
            if (!original || original.__cycleEnforcerV275) return;
            function wrapped() {
                filterAllDays();
                const result = original.apply(this, arguments);
                filterAllDays();
                return result;
            }
            wrapped.__cycleEnforcerV275 = true;
            wrapped.__original = original;
            setValue(name, wrapped);
        });
    }

    function boot() {
        installInitialCycleGate();
        installBlockedFilter();
        installPlannerFilter();
        installRenderFilters();
        filterAllDays();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
    setTimeout(boot, 500);
    setTimeout(boot, 1500);
})();
