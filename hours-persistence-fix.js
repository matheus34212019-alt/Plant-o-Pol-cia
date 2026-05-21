(function plantaoHoursPersistenceFix() {
    if(window.__plantaoHoursPersistenceFix) return;
    window.__plantaoHoursPersistenceFix = true;

    const VERSION = 'v218-hours-persistence';
    const STORAGE_FALLBACK_PREFIX = 'plantao_horas_diarias_v1_';

    function getDb() {
        try { return Function('return typeof db === "undefined" ? null : db;')(); }
        catch(_) { return window.db || null; }
    }

    function setDb(value) {
        try { Function('value', 'db = value;')(value); } catch(_) {}
        try { window.db = value; } catch(_) {}
    }

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function setFn(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function number(value) {
        const n = parseFloat(value);
        return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
    }

    function normalizeHours(source) {
        const out = {};
        for(let i = 0; i < 7; i += 1) out[i] = number(source?.[i]);
        return out;
    }

    function sameHours(a, b) {
        for(let i = 0; i < 7; i += 1) {
            if(number(a?.[i]) !== number(b?.[i])) return false;
        }
        return true;
    }

    function identityKey() {
        try {
            const preferenciasKey = fn('preferenciasKey');
            if(preferenciasKey) return preferenciasKey();
        } catch(_) {}
        try {
            const alvo = fn('alvoDadosNuvem')?.();
            if(alvo?.user_id) return STORAGE_FALLBACK_PREFIX + String(alvo.user_id);
            if(alvo?.email) return STORAGE_FALLBACK_PREFIX + String(alvo.email).toLowerCase();
        } catch(_) {}
        try {
            const cloud = Function('return typeof cloudUser === "undefined" ? null : cloudUser;')();
            if(cloud?.id) return STORAGE_FALLBACK_PREFIX + String(cloud.id);
            if(cloud?.email) return STORAGE_FALLBACK_PREFIX + String(cloud.email).toLowerCase();
        } catch(_) {}
        return STORAGE_FALLBACK_PREFIX + 'local';
    }

    function readPrefs() {
        try {
            const raw = localStorage.getItem(identityKey());
            return raw ? JSON.parse(raw) : {};
        } catch(_) {
            return {};
        }
    }

    function writePrefs(hours) {
        try {
            const prefs = readPrefs();
            prefs.horasDiarias = normalizeHours(hours);
            prefs.updatedAt = new Date().toISOString();
            localStorage.setItem(identityKey(), JSON.stringify(prefs));
        } catch(_) {}
    }

    function writeActiveDb(db) {
        try { localStorage.setItem('prf_v120', JSON.stringify(db)); } catch(_) {}
        try {
            if(typeof window.__plantaoGetActiveDataKey === 'function' && typeof window.__plantaoWriteRawStorageKey === 'function') {
                window.__plantaoWriteRawStorageKey(window.__plantaoGetActiveDataKey(), JSON.stringify(db));
            }
        } catch(_) {}
    }

    function applyHours(hours, reason = 'apply') {
        const db = getDb();
        if(!db || typeof db !== 'object') return false;
        const normalized = normalizeHours(hours);
        if(!sameHours(db.h, normalized)) {
            db.h = normalized;
            db.horasDiariasAtualizadasEm = new Date().toISOString();
            db.horasDiariasOrigem = reason;
            setDb(db);
            writeActiveDb(db);
            window.dispatchEvent(new CustomEvent('plantao:hours-applied', { detail: { version: VERSION, reason, hours: normalized } }));
            return true;
        }
        return false;
    }

    function readSavedHours() {
        const prefs = readPrefs();
        return prefs?.horasDiarias ? normalizeHours(prefs.horasDiarias) : null;
    }

    function applySavedHours(reason = 'saved-hours') {
        const saved = readSavedHours();
        if(!saved) return false;
        return applyHours(saved, reason);
    }

    function captureInputs() {
        const hours = {};
        for(let i = 0; i < 7; i += 1) {
            const input = document.getElementById(`h-in-${i}`);
            hours[i] = number(input?.value);
        }
        return hours;
    }

    async function forceCloudHours(hours) {
        try {
            const supabaseClient = Function('return typeof supabaseClient === "undefined" ? null : supabaseClient;')();
            const alvoDadosNuvem = fn('alvoDadosNuvem');
            if(!supabaseClient || !alvoDadosNuvem) return false;
            const target = alvoDadosNuvem();
            if(!target?.user_id) return false;
            const current = getDb();
            if(!current) return false;
            const payload = JSON.parse(JSON.stringify(current));
            payload.h = normalizeHours(hours);
            payload.horasDiariasAtualizadasEm = new Date().toISOString();
            payload.horasDiariasOrigem = 'cloud-force';
            await supabaseClient
                .from('plantao_user_data')
                .upsert({
                    user_id: target.user_id,
                    email: target.email || null,
                    data: payload,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
            return true;
        } catch(_) {
            return false;
        }
    }

    function patchSaveH() {
        const original = fn('saveH');
        if(typeof original !== 'function' || original.__plantaoHoursPersistenceWrapped) return;
        function wrappedSaveH() {
            const hours = captureInputs();
            writePrefs(hours);
            window.__plantaoLastSavedHours = normalizeHours(hours);
            const result = original.apply(this, arguments);
            applyHours(hours, 'saveH');
            setTimeout(() => applyHours(hours, 'saveH-post'), 80);
            setTimeout(() => forceCloudHours(hours), 300);
            return result;
        }
        wrappedSaveH.__plantaoHoursPersistenceWrapped = true;
        wrappedSaveH.__plantaoOriginal = original;
        setFn('saveH', wrappedSaveH);
    }

    function patchFunction(name, after) {
        const original = fn(name);
        if(typeof original !== 'function' || original.__plantaoHoursPatchWrapped) return;
        function wrapped() {
            const result = original.apply(this, arguments);
            if(result && typeof result.finally === 'function') {
                result.finally(() => after(name));
            } else {
                after(name);
            }
            return result;
        }
        wrapped.__plantaoHoursPatchWrapped = true;
        wrapped.__plantaoOriginal = original;
        setFn(name, wrapped);
    }

    function install() {
        patchSaveH();
        ['aplicarPreferenciasLocais', 'normalizarBanco', 'carregarDadosSupabase', 'ocultarTelaLogin', 'init'].forEach(name => {
            patchFunction(name, () => setTimeout(() => applySavedHours(name), 0));
        });
        applySavedHours('install');
        document.documentElement.dataset.hoursPersistence = VERSION;
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();

    let tries = 0;
    const retry = setInterval(() => {
        tries += 1;
        install();
        if(tries > 40) clearInterval(retry);
    }, 250);
})();
