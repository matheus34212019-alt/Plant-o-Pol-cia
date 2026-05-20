(function plantaoAccountIsolationFix() {
    if(window.__plantaoAccountIsolationFixInstalled) return;
    window.__plantaoAccountIsolationFixInstalled = true;

    const LEGACY_KEY = 'prf_v120';
    const LOCAL_KEY = 'plantao_db_local_v1';
    const ACTIVE_KEY = 'plantao_active_db_key_v1';
    const USER_PREFIX = 'plantao_db_user_v1_';

    const previousGetItem = Storage.prototype.getItem;
    const previousSetItem = Storage.prototype.setItem;
    const previousRemoveItem = Storage.prototype.removeItem;
    const previousKey = Storage.prototype.key;

    function safeId(value) {
        return String(value || 'local')
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'local';
    }

    function keyForIdentity(identity) {
        return USER_PREFIX + safeId(identity);
    }

    function isStudentKey(key) {
        return String(key || '').startsWith(USER_PREFIX + 'aluno-');
    }

    function rawGet(key) {
        try {
            if(typeof window.__plantaoReadRawStorageKey === 'function') return window.__plantaoReadRawStorageKey(key);
        } catch(e) {}
        try { return previousGetItem.call(localStorage, key); } catch(e) { return null; }
    }

    function rawSet(key, value) {
        try {
            if(typeof window.__plantaoWriteRawStorageKey === 'function') return window.__plantaoWriteRawStorageKey(key, value);
        } catch(e) {}
        try { return previousSetItem.call(localStorage, key, value); } catch(e) {}
    }

    function rawRemove(key) {
        try { return previousRemoveItem.call(localStorage, key); } catch(e) {}
    }

    function decodeJwtPayload(token) {
        try {
            const part = String(token || '').split('.')[1];
            if(!part) return null;
            const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
            const json = decodeURIComponent(
                Array.from(atob(padded), c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
            );
            return JSON.parse(json);
        } catch(e) {
            return null;
        }
    }

    function sessionIdentity() {
        try {
            for(let i = 0; i < localStorage.length; i += 1) {
                const key = previousKey.call(localStorage, i);
                if(!key || !key.startsWith('sb-')) continue;
                const raw = rawGet(key);
                if(!raw) continue;
                const parsed = JSON.parse(raw);
                const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
                const payload = decodeJwtPayload(token);
                if(payload?.sub) return payload.sub;
            }
        } catch(e) {}
        return null;
    }

    function adminKey() {
        const identity = sessionIdentity();
        if(identity) return keyForIdentity(identity);
        const saved = rawGet(ACTIVE_KEY);
        return saved && !isStudentKey(saved) ? saved : LOCAL_KEY;
    }

    function safeActiveKey() {
        if(window.__plantaoForcedDataKey) return window.__plantaoForcedDataKey;
        const identity = sessionIdentity();
        if(identity) return keyForIdentity(identity);
        const memoryKey = window.__plantaoDataIsolationActiveKey;
        if(memoryKey && !isStudentKey(memoryKey)) return memoryKey;
        const saved = rawGet(ACTIVE_KEY);
        if(saved && !isStudentKey(saved)) return saved;
        return LOCAL_KEY;
    }

    function syncMainAccountKey() {
        if(window.__plantaoForcedDataKey) {
            const key = adminKey();
            if(key && !isStudentKey(key)) rawSet(ACTIVE_KEY, key);
            return;
        }
        const identity = sessionIdentity();
        if(identity) {
            const key = keyForIdentity(identity);
            window.__plantaoDataIsolationActiveKey = key;
            rawSet(ACTIVE_KEY, key);
            return;
        }
        const saved = rawGet(ACTIVE_KEY);
        if(isStudentKey(saved)) rawRemove(ACTIVE_KEY);
    }

    function patchStorage() {
        if(Storage.prototype.__plantaoAccountIsolationPatched) return;
        Storage.prototype.getItem = function accountGetItem(key) {
            if(this === localStorage && key === LEGACY_KEY) return rawGet(safeActiveKey());
            return previousGetItem.call(this, key);
        };
        Storage.prototype.setItem = function accountSetItem(key, value) {
            if(this === localStorage && key === LEGACY_KEY) return rawSet(safeActiveKey(), value);
            if(this === localStorage && key === ACTIVE_KEY && isStudentKey(value) && !window.__plantaoForcedDataKey) return rawSet(ACTIVE_KEY, adminKey());
            return previousSetItem.call(this, key, value);
        };
        Storage.prototype.removeItem = function accountRemoveItem(key) {
            if(this === localStorage && key === LEGACY_KEY) return rawRemove(safeActiveKey());
            return previousRemoveItem.call(this, key);
        };
        Storage.prototype.key = function accountStorageKey(index) {
            if(this !== localStorage) return previousKey.call(this, index);
            const visible = [];
            for(let i = 0; i < localStorage.length; i += 1) {
                const key = previousKey.call(localStorage, i);
                if(!key) continue;
                if(isStudentKey(key) && window.__plantaoForcedDataKey !== key) continue;
                visible.push(key);
            }
            return visible[index] || null;
        };
        Storage.prototype.__plantaoAccountIsolationPatched = true;
    }

    function patchOwnerApi() {
        window.__plantaoGetActiveDataKey = safeActiveKey;
        window.__plantaoSetDataOwner = function setSafeDataOwner(identity, forced = false) {
            const key = keyForIdentity(identity);
            if(forced) {
                window.__plantaoForcedDataKey = key;
                window.__plantaoDataIsolationActiveKey = key;
                rawSet(ACTIVE_KEY, adminKey());
                return key;
            }
            window.__plantaoForcedDataKey = '';
            window.__plantaoDataIsolationActiveKey = key;
            rawSet(ACTIVE_KEY, key);
            return key;
        };
        window.__plantaoClearDataOwner = function clearSafeDataOwner() {
            window.__plantaoForcedDataKey = '';
            window.__plantaoDataIsolationActiveKey = '';
            rawRemove(ACTIVE_KEY);
        };
    }

    function patchStudentNavigation() {
        if(typeof window.entrarPerfilAluno === 'function' && !window.entrarPerfilAluno.__plantaoAccountIsolationWrapped) {
            const original = window.entrarPerfilAluno;
            window.entrarPerfilAluno = async function entrarPerfilAlunoIsolado() {
                const mainKey = adminKey();
                const result = await original.apply(this, arguments);
                if(mainKey && !isStudentKey(mainKey)) rawSet(ACTIVE_KEY, mainKey);
                return result;
            };
            window.entrarPerfilAluno.__plantaoAccountIsolationWrapped = true;
        }

        if(typeof window.voltarPerfilAdmin === 'function' && !window.voltarPerfilAdmin.__plantaoAccountIsolationWrapped) {
            const original = window.voltarPerfilAdmin;
            window.voltarPerfilAdmin = async function voltarPerfilAdminIsolado() {
                window.__plantaoForcedDataKey = '';
                const key = adminKey();
                if(key && !isStudentKey(key)) rawSet(ACTIVE_KEY, key);
                return original.apply(this, arguments);
            };
            window.voltarPerfilAdmin.__plantaoAccountIsolationWrapped = true;
        }
    }

    function install() {
        patchStorage();
        patchOwnerApi();
        syncMainAccountKey();
        patchStudentNavigation();
        return typeof window.__plantaoReadRawStorageKey === 'function' && typeof window.entrarComSessaoSupabase === 'function';
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true, capture: true });
    } else {
        install();
    }

    const timer = setInterval(() => {
        install();
    }, 120);
    setTimeout(() => clearInterval(timer), 12000);
})();