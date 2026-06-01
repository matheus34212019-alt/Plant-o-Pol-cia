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

(function plantaoLaunchDedupeLoader() {
    if(window.__plantaoLaunchDedupeLoader) return;
    window.__plantaoLaunchDedupeLoader = true;
    if(window.__plantaoLaunchDedupeFix) return;
    const script = document.createElement('script');
    script.src = 'launch-dedupe-fix.js?v=242-launch-dedupe';
    script.defer = true;
    document.head.appendChild(script);
})();

(function plantaoScheduleLogicFixLoader() {
    if(window.__plantaoScheduleLogicFixLoader) return;
    window.__plantaoScheduleLogicFixLoader = true;
    if(window.__plantaoScheduleLogicFix) return;
    const script = document.createElement('script');
    script.src = 'schedule-logic-fix.js?v=251-schedule-logic';
    script.defer = true;
    document.head.appendChild(script);
})();

(function plantaoOAuthSessionReturnFix() {
    if(window.__plantaoOAuthSessionReturnFix) return;
    window.__plantaoOAuthSessionReturnFix = true;

    const WRAPPED = '__plantaoOAuthSessionReturnWrapped';

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function value(name) {
        try { return Function(`return typeof ${name} === "undefined" ? null : ${name};`)(); }
        catch(_) { return window[name] || null; }
    }

    function setFn(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch(_) {}
        try { window[name] = replacement; } catch(_) {}
    }

    function rememberSession(result) {
        const session = result?.data?.session || result?.session || null;
        if(session?.user) {
            window.__plantaoOAuthReturnedSession = session;
            try { fn('setCloudStatus')?.('Login confirmado. Carregando seus dados...'); } catch(_) {}
        }
        return result;
    }

    function wrapClient(client) {
        const auth = client?.auth;
        if(!auth?.exchangeCodeForSession || auth.exchangeCodeForSession[WRAPPED]) return client;
        const originalExchange = auth.exchangeCodeForSession.bind(auth);
        auth.exchangeCodeForSession = async function exchangeCodeForSessionComSessaoGuardada() {
            return rememberSession(await originalExchange.apply(this, arguments));
        };
        auth.exchangeCodeForSession[WRAPPED] = true;
        return client;
    }

    function patchClientFactory() {
        const original = fn('criarClienteSupabase');
        if(!original || original[WRAPPED]) return false;
        function criarClienteSupabaseComRetornoOAuth() {
            return wrapClient(original.apply(this, arguments));
        }
        criarClienteSupabaseComRetornoOAuth[WRAPPED] = true;
        criarClienteSupabaseComRetornoOAuth.__plantaoOriginal = original;
        setFn('criarClienteSupabase', criarClienteSupabaseComRetornoOAuth);
        const activeClient = value('supabaseClient');
        if(activeClient) wrapClient(activeClient);
        return true;
    }

    function patchSessionWaiter() {
        const original = fn('esperarSessaoSupabase');
        if(!original || original[WRAPPED]) return false;
        async function esperarSessaoSupabaseComRetornoOAuth() {
            const returned = window.__plantaoOAuthReturnedSession;
            if(returned?.user) return returned;
            const session = await original.apply(this, arguments);
            return session || window.__plantaoOAuthReturnedSession || null;
        }
        esperarSessaoSupabaseComRetornoOAuth[WRAPPED] = true;
        esperarSessaoSupabaseComRetornoOAuth.__plantaoOriginal = original;
        setFn('esperarSessaoSupabase', esperarSessaoSupabaseComRetornoOAuth);
        return true;
    }

    function install() {
        return patchClientFactory() && patchSessionWaiter();
    }

    install();
    const timer = setInterval(() => {
        if(install()) clearInterval(timer);
    }, 50);
    setTimeout(() => clearInterval(timer), 6000);
})();

(function plantaoAuthSessionRescue() {
    if(window.__plantaoAuthSessionRescue) return;
    window.__plantaoAuthSessionRescue = true;

    const VERSION = 'v250-auth-session-rescue';
    const ACCESS_TABLE = 'plantao_user_access';
    const DATA_TABLE = 'plantao_user_data';
    const ADMIN_EMAIL = 'matheus34212019@gmail.com';
    const OWNER_FIELD = '__plantaoOwner';
    let running = false;
    let opened = false;

    function value(name, fallback = null) {
        try {
            const found = Function(`return typeof ${name} === "undefined" ? null : ${name};`)();
            return found ?? fallback;
        } catch(_) {
            return fallback;
        }
    }

    function setValue(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch(_) {}
    }

    function fn(name) {
        const found = value(name);
        return typeof found === 'function' ? found : null;
    }

    function status(text) {
        try { fn('setCloudStatus')?.(text); } catch(_) {}
    }

    function client() {
        let supabase = value('supabaseClient', null);
        if(supabase?.auth) return supabase;
        const create = fn('criarClienteSupabase');
        if(!create) return null;
        try {
            supabase = create();
            setValue('supabaseClient', supabase);
            return supabase;
        } catch(_) {
            return null;
        }
    }

    function cleanEmail(user) {
        return String(user?.email || '').trim().toLowerCase();
    }

    function defaultData(user, reason) {
        return {
            lista: [],
            ciclo: [],
            h: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 0: 4 },
            metaFixa: {},
            [OWNER_FIELD]: {
                userId: String(user?.id || ''),
                version: VERSION,
                reason,
                updatedAt: new Date().toISOString()
            }
        };
    }

    function clone(data) {
        try { return JSON.parse(JSON.stringify(data || {})); }
        catch(_) { return {}; }
    }

    function stamp(data, user, reason) {
        if(!data || !user?.id) return data;
        data[OWNER_FIELD] = {
            userId: String(user.id),
            version: VERSION,
            reason,
            updatedAt: new Date().toISOString()
        };
        return data;
    }

    function score(data) {
        const lista = Array.isArray(data?.lista) ? data.lista.length : 0;
        const tasks = Object.values(data?.metaFixa || {}).flat().filter(Boolean).length;
        const lancamentos = Array.isArray(data?.lancamentos) ? data.lancamentos.length : 0;
        return lista * 4 + tasks * 2 + lancamentos * 3;
    }

    function loginVisible() {
        const screen = document.getElementById('login-screen');
        if(!screen) return false;
        return getComputedStyle(screen).display !== 'none';
    }

    function hideLogin() {
        const screen = document.getElementById('login-screen');
        if(screen) screen.style.display = 'none';
        document.body?.classList.remove('plantao-data-loading');
    }

    function showLogin(message) {
        const screen = document.getElementById('login-screen');
        if(screen) screen.style.display = 'flex';
        if(message) status(message);
    }

    function finish(data, user, profile, reason) {
        const next = stamp(clone(data), user, `${reason}-loaded`);
        setValue('cloudUser', { ...user, provider: 'supabase' });
        setValue('accessProfile', profile);
        setValue('db', next);
        setValue('carregandoNuvem', true);
        try { localStorage.setItem('prf_v120', JSON.stringify(next)); } catch(_) {}
        try { fn('normalizarBanco')?.(); } catch(_) {}
        try { fn('aplicarPreferenciasLocais')?.(); } catch(_) {}
        stamp(value('db', next), user, `${reason}-normalized`);
        try { localStorage.setItem('prf_v120', JSON.stringify(value('db', next))); } catch(_) {}
        setValue('dadosSupabaseCarregados', true);
        setValue('carregandoNuvem', false);
        window.__plantaoCloudDataReady = true;
        document.documentElement.dataset.authSessionRescue = VERSION;
        hideLogin();
        try { fn('atualizarPersonalizacao')?.(); } catch(_) {}
        try { fn('init')?.(); } catch(_) {}
        opened = true;
        return true;
    }

    async function currentSession(supabase) {
        if(window.__plantaoOAuthReturnedSession?.user) return window.__plantaoOAuthReturnedSession;
        try {
            const { data } = await supabase.auth.getSession();
            if(data?.session?.user) return data.session;
        } catch(_) {}
        return null;
    }

    async function ownDataRow(supabase, user) {
        const result = await supabase
            .from(DATA_TABLE)
            .select('data,user_id,email,updated_at')
            .eq('user_id', user.id)
            .maybeSingle();
        if(result.error) throw result.error;
        return result.data || null;
    }

    async function createOwnDataRow(supabase, user) {
        const data = defaultData(user, 'auth-session-rescue-empty-row');
        const payload = {
            user_id: user.id,
            email: cleanEmail(user) || null,
            data,
            updated_at: new Date().toISOString()
        };
        const result = await supabase.from(DATA_TABLE).upsert(payload, { onConflict: 'user_id' });
        if(result.error) throw result.error;
        return data;
    }

    async function accessByEmail(supabase, user) {
        const email = cleanEmail(user);
        const now = new Date().toISOString();
        if(email === ADMIN_EMAIL) {
            const profile = {
                user_id: user.id,
                email,
                name: user.user_metadata?.full_name || user.user_metadata?.name || 'Matheus',
                role: 'admin',
                status: 'approved',
                requested_at: now,
                approved_at: now,
                approved_by: email
            };
            supabase.from(ACCESS_TABLE).upsert(profile, { onConflict: 'email' }).catch(() => {});
            return profile;
        }

        const result = await supabase
            .from(ACCESS_TABLE)
            .select('*')
            .eq('email', email)
            .maybeSingle();
        if(result.error) throw result.error;
        if(result.data) {
            if(result.data.user_id !== user.id) {
                supabase.from(ACCESS_TABLE).update({
                    user_id: user.id,
                    name: result.data.name || user.user_metadata?.full_name || user.user_metadata?.name || email
                }).eq('email', email).catch(() => {});
            }
            return { ...result.data, user_id: user.id };
        }

        const pending = {
            user_id: user.id,
            email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || email,
            role: 'aluno',
            status: 'pending',
            requested_at: now
        };
        await supabase.from(ACCESS_TABLE).insert(pending).catch(() => null);
        return pending;
    }

    async function loadApprovedData(supabase, user, profile) {
        const row = await ownDataRow(supabase, user);
        if(row?.data) return finish(row.data, user, profile, 'auth-session-rescue-remote-row');
        const data = await createOwnDataRow(supabase, user);
        return finish(data, user, profile, 'auth-session-rescue-new-row');
    }

    async function rescue(reason = 'timer') {
        if(running || opened) return false;
        const supabase = client();
        if(!supabase?.auth) return false;

        const session = await currentSession(supabase);
        if(!session?.user) return false;
        if(!loginVisible() && value('cloudUser', null)) return false;

        running = true;
        try {
            if(session.access_token) {
                setValue('supabaseAccessToken', session.access_token);
                try {
                    const create = fn('criarClienteSupabase');
                    if(create) setValue('supabaseClient', create(session.access_token));
                } catch(_) {}
            }
            const activeClient = client() || supabase;
            const user = session.user;
            let profile = null;

            try {
                profile = await accessByEmail(activeClient, user);
            } catch(accessError) {
                const row = await ownDataRow(activeClient, user).catch(() => null);
                if(row?.data) {
                    profile = { user_id: user.id, email: cleanEmail(user), role: 'aluno', status: 'approved' };
                    return finish(row.data, user, profile, 'auth-session-rescue-own-row-fallback');
                }
                throw accessError;
            }

            if(profile?.status !== 'approved') {
                const message = profile?.status === 'rejected'
                    ? 'Seu acesso foi recusado pelo administrador.'
                    : 'Seu acesso foi solicitado. Aguarde aprovacao do administrador.';
                showLogin(message);
                return false;
            }

            status('Login confirmado. Carregando seus dados...');
            return await loadApprovedData(activeClient, user, profile);
        } catch(error) {
            const text = String(error?.message || error || '').toLowerCase();
            const friendly = text.includes('failed to fetch') || text.includes('network')
                ? 'Falha de conexao com a nuvem. Confira a internet e tente novamente.'
                : 'Nao foi possivel abrir sua conta agora. Recarregue a pagina e tente novamente.';
            showLogin(friendly);
            return false;
        } finally {
            running = false;
        }
    }

    function installButtonRescue() {
        ['loginGoogle', 'entrarEmailSenha'].forEach(name => {
            const original = fn(name);
            if(!original || original.__plantaoAuthSessionRescueWrapped) return;
            const wrapped = async function authActionWithRescue() {
                const result = await original.apply(this, arguments);
                [800, 2200, 5000].forEach(delay => setTimeout(() => rescue(name), delay));
                return result;
            };
            wrapped.__plantaoAuthSessionRescueWrapped = true;
            try { Function('wrapped', `${name} = wrapped;`)(wrapped); } catch(_) {}
            try { window[name] = wrapped; } catch(_) {}
        });
    }

    function boot() {
        installButtonRescue();
        [300, 900, 1800, 3500, 7000, 12000].forEach(delay => {
            setTimeout(() => {
                installButtonRescue();
                rescue(`boot-${delay}`);
            }, delay);
        });
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();

(function plantaoAccountSafetyOrderedLoader() {
    if(window.__plantaoAccountSafetyOrderedLoader) return;
    window.__plantaoAccountSafetyOrderedLoader = true;

    const queue = [
        {
            src: 'account-strict-guard.js?v=247-login-unlock',
            loaded: () => window.__plantaoStrictAccountGuard
        },
        {
            src: 'account-row-bootstrap-fix.js?v=247-login-unlock-bootstrap',
            loaded: () => window.__plantaoAccountRowBootstrapFix
        },
        {
            src: 'login-unlock-fix.js?v=247-login-unlock',
            loaded: () => window.__plantaoLoginUnlockFix
        }
    ];

    function loadNext(index) {
        const item = queue[index];
        if(!item) return;
        if(item.loaded()) {
            loadNext(index + 1);
            return;
        }

        const existing = Array.from(document.scripts || [])
            .find(script => (script.src || '').includes(item.src.split('?')[0]));
        if(existing) {
            existing.addEventListener('load', () => loadNext(index + 1), { once: true });
            setTimeout(() => loadNext(index + 1), 900);
            return;
        }

        const script = document.createElement('script');
        script.src = item.src;
        script.async = false;
        script.onload = () => loadNext(index + 1);
        script.onerror = () => loadNext(index + 1);
        document.head.appendChild(script);
    }

    loadNext(0);
})();
