(function plantaoHistoryPreservationFix() {
    if(window.__plantaoHistoryPreservationFix) return;
    window.__plantaoHistoryPreservationFix = true;

    const VERSION = 'v224-independent-history';
    const WRAPPED = '__plantaoHistoryPreserveWrapped';
    const RESET_FUNCTIONS = [
        'impEdital',
        'saveC',
        'saveH',
        'removerMateria',
        'sinalizarAssunto',
        'ativarAssuntoCicloInicial',
        'sinalizarMateria',
        'salvarFluxoMateria',
        'salvarFluxoAssunto'
    ];

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function setFn(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function state() {
        try { return Function('return typeof db === "undefined" ? null : db;')(); }
        catch(_) { return window.db || null; }
    }

    function clone(value) {
        try { return JSON.parse(JSON.stringify(value)); } catch(_) { return value; }
    }

    function keyPart(value) {
        return String(value ?? '').replace(/[|]/g, '/');
    }

    function historyId(day, task, index) {
        return task?._historyId || [
            keyPart(day),
            keyPart(task?.itemId || task?.id || ''),
            keyPart(task?.m),
            keyPart(task?.a),
            keyPart(task?.k),
            keyPart(task?.l),
            keyPart(task?.h),
            keyPart(index)
        ].join('|');
    }

    function ensureLedger(data) {
        if(!Array.isArray(data.historicoEstudos)) data.historicoEstudos = [];
        return data.historicoEstudos;
    }

    function captureCompleted() {
        const data = state();
        if(!data?.metaFixa) return false;
        const ledger = ensureLedger(data);
        const known = new Set(ledger.map(row => row.id));
        let changed = false;
        Object.entries(data.metaFixa).forEach(([day, tasks]) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task, index) => {
                if(!task?.c) return;
                const id = historyId(day, task, index);
                task._historyId = id;
                if(known.has(id)) return;
                ledger.push({ id, dia: day, task: clone(task), recordedAt: new Date().toISOString() });
                known.add(id);
                changed = true;
            });
        });
        return changed;
    }

    function restoreCompleted() {
        const data = state();
        if(!data) return false;
        const ledger = ensureLedger(data);
        if(!ledger.length) return false;
        if(!data.metaFixa || typeof data.metaFixa !== 'object' || Array.isArray(data.metaFixa)) data.metaFixa = {};
        const visible = new Set();
        Object.entries(data.metaFixa).forEach(([day, tasks]) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task, index) => {
                if(task?.c) visible.add(historyId(day, task, index));
            });
        });
        let changed = false;
        ledger.forEach(row => {
            if(!row?.task?.c || visible.has(row.id)) return;
            if(!Array.isArray(data.metaFixa[row.dia])) data.metaFixa[row.dia] = [];
            const task = clone(row.task);
            task._historyId = row.id;
            task.c = true;
            data.metaFixa[row.dia].push(task);
            visible.add(row.id);
            changed = true;
        });
        return changed;
    }

    function persistRestored(reason) {
        const save = fn('save');
        if(save) save();
        const dashboard = fn('updateDashboard');
        if(dashboard) dashboard();
        document.documentElement.dataset.historyPreservation = VERSION;
        document.documentElement.dataset.historyPreservationReason = reason || 'restore';
    }

    function wrapSave() {
        const original = fn('save');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function saveWithHistory() {
            captureCompleted();
            return original.apply(this, arguments);
        }
        saveWithHistory[WRAPPED] = true;
        saveWithHistory.__plantaoOriginal = original;
        setFn('save', saveWithHistory);
        return true;
    }

    function wrapReset(name) {
        const original = fn(name);
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function preservingReset() {
            captureCompleted();
            const result = original.apply(this, arguments);
            if(restoreCompleted()) persistRestored(name);
            return result;
        }
        preservingReset[WRAPPED] = true;
        preservingReset.__plantaoOriginal = original;
        setFn(name, preservingReset);
        return true;
    }

    function removeHistoryForTask(day, index) {
        const data = state();
        const task = data?.metaFixa?.[day]?.[index];
        if(!task) return;
        const id = historyId(day, task, index);
        data.historicoEstudos = ensureLedger(data).filter(row => row.id !== id);
    }

    function wrapRemoval() {
        const original = fn('desmarcarLancamento');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function removeFromLedger(day, index) {
            removeHistoryForTask(day, index);
            return original.apply(this, arguments);
        }
        removeFromLedger[WRAPPED] = true;
        removeFromLedger.__plantaoOriginal = original;
        setFn('desmarcarLancamento', removeFromLedger);
        return true;
    }

    function wrapNormalizer() {
        const original = fn('normalizarBanco');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function normalizeWithHistory() {
            const result = original.apply(this, arguments);
            captureCompleted();
            restoreCompleted();
            return result;
        }
        normalizeWithHistory[WRAPPED] = true;
        normalizeWithHistory.__plantaoOriginal = original;
        setFn('normalizarBanco', normalizeWithHistory);
        return true;
    }

    function install() {
        wrapSave();
        wrapNormalizer();
        wrapRemoval();
        RESET_FUNCTIONS.forEach(wrapReset);
        captureCompleted();
        restoreCompleted();
        document.documentElement.dataset.historyPreservation = VERSION;
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
    const retry = setInterval(install, 250);
    setTimeout(() => clearInterval(retry), 10000);
})();
