(function plantaoScheduleLogicFix() {
    if(window.__plantaoScheduleLogicFix) return;
    window.__plantaoScheduleLogicFix = true;

    const VERSION = 'v251-schedule-logic';
    const WRAPPED = '__plantaoScheduleLogicWrapped';

    function value(name, fallback = null) {
        try {
            const found = Function(`return typeof ${name} === "undefined" ? null : ${name};`)();
            return found ?? fallback;
        } catch(_) {
            return fallback;
        }
    }

    function setFn(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch(_) {}
        try { window[name] = replacement; } catch(_) {}
    }

    function fn(name) {
        const found = value(name);
        return typeof found === 'function' ? found : null;
    }

    function dbRef() {
        const data = value('db', null);
        return data && typeof data === 'object' ? data : null;
    }

    function clone(data) {
        try { return JSON.parse(JSON.stringify(data)); }
        catch(_) { return Array.isArray(data) ? data.slice() : { ...(data || {}) }; }
    }

    function number(value) {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? n : 0;
    }

    function dayKey(date) {
        const local = fn('dateKey');
        if(local) return local(date);
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    function keyDate(key) {
        const local = fn('keyToDate');
        if(local) return startOfDay(local(key));
        const [day, month, year] = String(key || '').split('/').map(Number);
        return startOfDay(new Date(year || 2000, Math.max(0, (month || 1) - 1), day || 1));
    }

    function startOfDay(date) {
        const d = date instanceof Date ? new Date(date) : new Date(date || Date.now());
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date, amount) {
        const local = fn('addDays');
        if(local) return local(date, amount);
        const next = startOfDay(date);
        next.setDate(next.getDate() + (Number(amount) || 0));
        return next;
    }

    function isExtra(task) {
        const local = fn('isExtraTask');
        if(local) {
            try { return Boolean(local(task)); } catch(_) {}
        }
        return Boolean(task?.extra === true || task?.l === 'Extra');
    }

    function planned(tasks) {
        return (Array.isArray(tasks) ? tasks : []).filter(task => !isExtra(task));
    }

    function hours(tasks) {
        return planned(tasks).reduce((sum, task) => sum + number(task?.h), 0);
    }

    function limitFor(data, date) {
        return Math.max(0, number(data?.h?.[startOfDay(date).getDay()]));
    }

    function sameTask(a, b) {
        if(a?.recoveryId && b?.recoveryId && a.recoveryId === b.recoveryId) return true;
        if(a?.itemId && b?.itemId && a.itemId === b.itemId && a.k === b.k) return true;
        return String(a?.m || '').toUpperCase() === String(b?.m || '').toUpperCase()
            && String(a?.a || '').trim().toUpperCase() === String(b?.a || '').trim().toUpperCase()
            && a?.k === b?.k;
    }

    function mergeUnique(base, extras) {
        const out = [...(base || [])].map(task => ({ ...task }));
        (extras || []).forEach(task => {
            if(!out.some(existing => sameTask(existing, task))) out.push({ ...task });
        });
        return out;
    }

    function stripInternal(task) {
        const next = { ...(task || {}) };
        delete next.__planSig;
        delete next.__logicSig;
        return next;
    }

    function publicTasks(tasks) {
        return (tasks || []).map(stripInternal);
    }

    function equalTasks(a, b) {
        return JSON.stringify(publicTasks(a)) === JSON.stringify(publicTasks(b));
    }

    function saveIfChanged(key, next) {
        const data = dbRef();
        if(!data) return false;
        const current = data.metaFixa?.[key] || [];
        if(equalTasks(current, next)) return false;
        if(!data.metaFixa || typeof data.metaFixa !== 'object' || Array.isArray(data.metaFixa)) data.metaFixa = {};
        data.metaFixa[key] = next;
        const save = fn('save');
        if(save) save();
        return true;
    }

    function applyCompletionToState(task, key, state) {
        const complete = fn('concluirTaskNoState');
        if(!complete || !task?.c) return false;
        try { return Boolean(complete({ ...task }, key, state)); }
        catch(_) { return false; }
    }

    function applyCompletedBefore(state, untilDate) {
        const data = dbRef();
        if(!data?.metaFixa) return;
        Object.keys(data.metaFixa)
            .sort((a, b) => keyDate(a) - keyDate(b))
            .forEach(key => {
                if(keyDate(key) >= untilDate) return;
                planned(data.metaFixa[key]).filter(task => task.c).forEach(task => applyCompletionToState(task, key, state));
            });
    }

    function limitTasks(tasks, limit) {
        const limiter = fn('limitarPreservandoConcluidas') || fn('limitarTarefasAoLimite');
        if(limiter) {
            try { return limiter(tasks, limit); } catch(_) {}
        }
        if(limit <= 0) return planned(tasks).filter(task => task.c);
        const out = [];
        let total = 0;
        planned(tasks).forEach(task => {
            const h = number(task.h);
            if(task.c || total + h <= limit + 0.01) {
                out.push({ ...task });
                total += h;
            }
        });
        return out;
    }

    function planPool(state, date, limit) {
        if(limit <= 0.01) return [];
        const planner = fn('planejarDia') || fn('getNeuralPoolSim');
        if(!planner) return [];
        try {
            if(fn('planejarDia')) return planner(state, date, limit, true) || [];
            return planner(limit, state, date) || [];
        } catch(_) {
            return [];
        }
    }

    function composeDayFromState(state, key, date) {
        const data = dbRef();
        if(!data) return [];
        const existing = Array.isArray(data.metaFixa?.[key]) ? data.metaFixa[key] : [];
        const extras = existing.filter(isExtra).map(task => ({ ...task }));
        const completed = planned(existing).filter(task => task.c).map(task => ({ ...task }));
        const limit = limitFor(data, date);
        const used = hours(completed);
        const remaining = Math.max(0, limit - used);
        completed.forEach(task => applyCompletionToState(task, key, state));
        const pool = planPool(state, date, remaining)
            .filter(task => !task.c)
            .filter(task => !completed.some(done => sameTask(done, task)));
        const next = limitTasks(mergeUnique(completed, pool), limit);
        return [...next, ...extras];
    }

    function clearFuturePending(baseKey) {
        const data = dbRef();
        if(!data?.metaFixa) return false;
        const base = keyDate(baseKey || dayKey(new Date()));
        let changed = false;
        Object.keys(data.metaFixa).forEach(key => {
            if(keyDate(key) <= base) return;
            const keep = (Array.isArray(data.metaFixa[key]) ? data.metaFixa[key] : [])
                .filter(task => task?.c || isExtra(task));
            if(keep.length) data.metaFixa[key] = keep;
            else delete data.metaFixa[key];
            changed = true;
        });
        return changed;
    }

    function today() {
        return startOfDay(new Date());
    }

    function reconcileDay(key, date, state = null) {
        const data = dbRef();
        if(!data) return false;
        const d = startOfDay(date || keyDate(key));
        if(d < today()) return false;
        if(fn('diaPausado')?.(key)) return saveIfChanged(key, []);
        const sim = state || clone(data);
        applyCompletedBefore(sim, d);
        const next = composeDayFromState(sim, key, d);
        return saveIfChanged(key, next);
    }

    function calcularSemanaConsistente() {
        const data = dbRef();
        if(!data) return {};
        const start = today();
        start.setDate(start.getDate() - start.getDay());
        const sim = clone(data);
        const week = {};
        for(let off = 0; off < 7; off += 1) {
            const date = addDays(start, off);
            const key = dayKey(date);
            if(date < today()) {
                week[key] = limitTasks(planned(data.metaFixa?.[key] || []), limitFor(data, date));
                continue;
            }
            if(fn('diaPausado')?.(key)) {
                week[key] = [];
                continue;
            }
            applyCompletedBefore(sim, date);
            week[key] = planned(composeDayFromState(sim, key, date));
            week[key].filter(task => !task.c).forEach(task => applyCompletionToState({ ...task, c: true }, key, sim));
        }
        return week;
    }

    function fixarSemanaConsistente(semana, inicioSemana, hoje) {
        const data = dbRef();
        if(!data?.metaFixa) return;
        let changed = false;
        const baseToday = startOfDay(hoje || new Date());
        for(let off = 0; off < 7; off += 1) {
            const date = addDays(inicioSemana || baseToday, off);
            if(date < baseToday) continue;
            const key = dayKey(date);
            if(fn('diaPausado')?.(key)) {
                if(!equalTasks(data.metaFixa[key] || [], [])) {
                    data.metaFixa[key] = [];
                    changed = true;
                }
                continue;
            }
            const existing = Array.isArray(data.metaFixa[key]) ? data.metaFixa[key] : [];
            const extras = existing.filter(isExtra);
            const next = [...(semana?.[key] || []), ...extras];
            if(!equalTasks(existing, next)) {
                data.metaFixa[key] = next;
                changed = true;
            }
        }
        if(changed) fn('save')?.();
    }

    function installPlanning() {
        const originalEnsure = fn('garantirDiaPlanejado');
        if(originalEnsure && !originalEnsure[WRAPPED]) {
            function garantirDiaPlanejadoConsistente(key, date) {
                const d = startOfDay(date || keyDate(key));
                if(d < today()) return originalEnsure.apply(this, arguments);
                return reconcileDay(key, d);
            }
            garantirDiaPlanejadoConsistente[WRAPPED] = true;
            garantirDiaPlanejadoConsistente.__plantaoOriginal = originalEnsure;
            setFn('garantirDiaPlanejado', garantirDiaPlanejadoConsistente);
        }

        const originalWeek = fn('calcularSemanaPlanejada');
        if(originalWeek && !originalWeek[WRAPPED]) {
            calcularSemanaConsistente[WRAPPED] = true;
            calcularSemanaConsistente.__plantaoOriginal = originalWeek;
            setFn('calcularSemanaPlanejada', calcularSemanaConsistente);
        }

        const originalFixWeek = fn('fixarSemanaPlanejada');
        if(originalFixWeek && !originalFixWeek[WRAPPED]) {
            fixarSemanaConsistente[WRAPPED] = true;
            fixarSemanaConsistente.__plantaoOriginal = originalFixWeek;
            setFn('fixarSemanaPlanejada', fixarSemanaConsistente);
        }

        return true;
    }

    function installInvalidators() {
        ['concluirTask', 'confirmarExercicio', 'desmarcarLancamento', 'saveC', 'saveH', 'salvarFluxoMateria', 'salvarFluxoAssunto', 'marcarComoEstudado'].forEach(name => {
            const original = fn(name);
            if(!original || original[WRAPPED]) return;
            function withScheduleInvalidation() {
                const key = arguments[1] || arguments[0] || dayKey(new Date());
                const result = original.apply(this, arguments);
                const baseKey = typeof key === 'string' && key.includes('/') ? key : dayKey(new Date());
                if(result !== false && clearFuturePending(baseKey)) fn('save')?.();
                return result;
            }
            withScheduleInvalidation[WRAPPED] = true;
            withScheduleInvalidation.__plantaoOriginal = original;
            setFn(name, withScheduleInvalidation);
        });
    }

    function refreshVisible() {
        try {
            const currentDate = value('vDate', new Date()) || new Date();
            if(document.getElementById('diaria')?.classList.contains('active')) fn('renderDiario')?.(currentDate);
            if(document.getElementById('semanal')?.classList.contains('active')) fn('renderSemanal')?.();
            fn('updateDashboard')?.();
        } catch(_) {}
    }

    function install() {
        installPlanning();
        installInvalidators();
        document.documentElement.dataset.scheduleLogic = VERSION;
    }

    install();
    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            install();
            setTimeout(refreshVisible, 300);
        }, { once: true });
    } else {
        setTimeout(refreshVisible, 300);
    }

    const retry = setInterval(install, 250);
    setTimeout(() => clearInterval(retry), 10000);
})();
