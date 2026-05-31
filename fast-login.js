(function plantaoFastLogin() {
    if (window.__plantaoFastLoginV277) return;
    window.__plantaoFastLoginV277 = true;

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

    function setVar(name, val) {
        try { Function('val', `${name} = val;`)(val); } catch (_) {}
        try { window[name] = val; } catch (_) {}
    }

    function approvedProfile(user) {
        const email = String(user?.email || '').toLowerCase();
        const adminEmail = String(value('ADMIN_EMAIL', 'matheus34212019@gmail.com')).toLowerCase();
        return {
            user_id: user?.id || user?.uid || null,
            email,
            name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Aluno',
            role: email === adminEmail ? 'admin' : 'aluno',
            status: 'approved',
            fastLogin: true
        };
    }

    function forceHideLogin() {
        const login = document.getElementById('login-screen');
        if (login) {
            login.style.opacity = '0';
            login.style.pointerEvents = 'none';
            login.style.display = 'none';
            login.setAttribute('aria-hidden', 'true');
        }
        document.documentElement.classList.remove('login-lock', 'auth-loading');
        document.body.classList.remove('login-lock', 'auth-loading');
    }

    function scheduleLightInit() {
        const run = () => {
            try { fn('atualizarPersonalizacao')?.(); } catch (_) {}
            try { fn('init')?.(); } catch (_) {}
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(run, { timeout: 700 });
        } else {
            setTimeout(run, 0);
        }
    }

    function openAppNow(user) {
        const cloudUser = { ...user, provider: 'supabase' };
        setVar('cloudUser', cloudUser);
        setVar('accessProfile', approvedProfile(cloudUser));
        setVar('dadosSupabaseCarregados', true);
        setVar('carregandoNuvem', false);

        try { fn('iniciarSessaoPersistente')?.(); } catch (_) {}
        try { fn('setCloudStatus')?.(''); } catch (_) {}
        try { fn('ocultarTelaLogin')?.(); } catch (_) { forceHideLogin(); }
        forceHideLogin();
        scheduleLightInit();
    }

    function runBackgroundApproval(user) {
        setTimeout(async () => {
            try {
                const verificar = fn('verificarAcessoSupabase');
                if (!verificar) return;
                const profile = await Promise.race([
                    verificar(),
                    new Promise(resolve => setTimeout(() => resolve(null), 1500))
                ]);
                if (!profile) return;
                setVar('accessProfile', profile);
                const aprovado = fn('acessoAprovado') ? fn('acessoAprovado')() : profile.status === 'approved';
                if (!aprovado && fn('bloquearAcessoPorAprovacao')) fn('bloquearAcessoPorAprovacao')(profile);
            } catch (_) {}
        }, 5000);
    }

    function runBackgroundCloudSync() {
        setTimeout(async () => {
            try {
                const carregar = fn('carregarDadosSupabase') || fn('carregarDadosDaNuvem');
                if (!carregar) return;
                await Promise.race([
                    carregar(),
                    new Promise(resolve => setTimeout(resolve, 2500))
                ]);
            } catch (_) {}
        }, 9000);
    }

    function installToastQuiet() {
        const current = fn('showToast');
        if (!current || current.__fastLoginQuietV277) return;
        const original = current.__plantaoOriginalToast || current;
        function quietToast(title, body, type) {
            const text = `${title || ''} ${body || ''}`.toLowerCase();
            if (/dados sincronizados|nuvem ativada|sincroniza|supabase|carregado|falha ao salvar|copia local|c.pia local|acesso liberado|corrigido|recalculado|replanejado|cronograma corrigido|horas corrigidas/.test(text)) return;
            return original.apply(this, arguments);
        }
        quietToast.__plantaoOriginalToast = original;
        quietToast.__fastLoginQuietV277 = true;
        setValue('showToast', quietToast);
    }

    function installFastSession() {
        const original = fn('entrarComSessaoSupabase');
        if (!original || original.__fastLoginV277) return false;
        async function entrarComSessaoSupabaseRapido(user) {
            openAppNow(user);
            runBackgroundApproval(user);
            runBackgroundCloudSync();
            return true;
        }
        entrarComSessaoSupabaseRapido.__fastLoginV277 = true;
        entrarComSessaoSupabaseRapido.__original = original;
        setValue('entrarComSessaoSupabase', entrarComSessaoSupabaseRapido);
        return true;
    }

    function installFastCloudLoad() {
        const original = fn('carregarDadosDaNuvem');
        if (!original || original.__fastLoginV277) return false;
        async function carregarDadosDaNuvemSemBloquear() {
            setTimeout(() => original().catch(() => {}), 9000);
            return true;
        }
        carregarDadosDaNuvemSemBloquear.__fastLoginV277 = true;
        carregarDadosDaNuvemSemBloquear.__original = original;
        setValue('carregarDadosDaNuvem', carregarDadosDaNuvemSemBloquear);
        return true;
    }

    function installFastSave() {
        const original = fn('salvarDadosSupabase');
        if (!original || original.__fastLoginV277) return false;
        async function salvarDadosSupabaseSemBloquear(imediato) {
            if (imediato === true) {
                setTimeout(() => original(true).catch(() => {}), 1200);
                return true;
            }
            return original.apply(this, arguments);
        }
        salvarDadosSupabaseSemBloquear.__fastLoginV277 = true;
        salvarDadosSupabaseSemBloquear.__original = original;
        setValue('salvarDadosSupabase', salvarDadosSupabaseSemBloquear);
        return true;
    }

    function boot() {
        installToastQuiet();
        installFastSession();
        installFastCloudLoad();
        installFastSave();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    boot();
    const timer = setInterval(boot, 100);
    setTimeout(() => clearInterval(timer), 5000);
})();
