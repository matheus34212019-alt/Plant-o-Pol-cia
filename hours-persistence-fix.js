(function plantaoHoursPersistenceFix() {
    if(window.__plantaoHoursPersistenceFix) return;
    window.__plantaoHoursPersistenceFix = true;

    const VERSION = 'v224-safe-hours-save';
    const WRAPPED = '__plantaoHoursPersistenceWrapped';

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function setFn(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function getDb() {
        try { return Function('return typeof db === "undefined" ? null : db;')(); }
        catch(_) { return window.db || null; }
    }

    function number(value) {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
    }

    function captureInputs() {
        const hours = {};
        for(let i = 0; i < 7; i += 1) {
            hours[i] = number(document.getElementById(`h-in-${i}`)?.value);
        }
        return hours;
    }

    function sameHours(a, b) {
        for(let i = 0; i < 7; i += 1) {
            if(number(a?.[i]) !== number(b?.[i])) return false;
        }
        return true;
    }

    function patchSaveH() {
        const original = fn('saveH');
        if(typeof original !== 'function' || original[WRAPPED]) return false;
        function safeSaveH() {
            const selected = captureInputs();
            const data = getDb();
            if(data) {
                data.horasDiariasAtualizadasEm = new Date().toISOString();
                data.horasDiariasOrigem = 'configuracao-do-aluno';
            }
            const result = original.apply(this, arguments);
            if(data && !sameHours(data.h, selected)) {
                data.h = selected;
                const save = fn('save');
                if(save) save();
            }
            return result;
        }
        safeSaveH[WRAPPED] = true;
        safeSaveH.__plantaoOriginal = original;
        setFn('saveH', safeSaveH);
        return true;
    }

    function install() {
        patchSaveH();
        document.documentElement.dataset.hoursPersistence = VERSION;
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
    const retry = setInterval(install, 250);
    setTimeout(() => clearInterval(retry), 10000);
})();
