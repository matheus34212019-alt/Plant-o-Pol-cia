(function authPreviewGuard() {
    if(window.__plantaoAuthPreviewGuardLoaded) return;
    window.__plantaoAuthPreviewGuardLoaded = true;

    const LOGIN_FLAG = 'plantao_login_google_em_andamento';

    function setCloudStatus(texto) {
        const el = document.getElementById('cloud-login-status');
        if(el) el.innerText = texto;
    }

    function manterTelaLogin() {
        document.body.classList.add('auth-waiting-google');
        const tela = document.getElementById('login-screen');
        if(tela) tela.style.display = 'flex';
    }

    function liberarTelaLoginQuandoAutorizado() {
        const original = window.ocultarTelaLogin;
        if(typeof original !== 'function' || original.__authPreviewGuardWrapped) return false;

        window.ocultarTelaLogin = function ocultarTelaLoginSemPreview() {
            document.body.classList.remove('auth-waiting-google');
            return original.apply(this, arguments);
        };
        window.ocultarTelaLogin.__authPreviewGuardWrapped = true;
        return true;
    }

    function instalarEstilo() {
        if(document.getElementById('auth-preview-guard-style')) return;
        const style = document.createElement('style');
        style.id = 'auth-preview-guard-style';
        style.textContent = `
            body.auth-waiting-google .sidebar,
            body.auth-waiting-google .main {
                visibility: hidden;
                pointer-events: none;
            }

            body.auth-waiting-google #login-screen {
                display: flex !important;
            }
        `;
        document.head.appendChild(style);
    }

    function supabasePronto() {
        return Boolean(
            window.supabase
            && typeof window.supabase.createClient === 'function'
            && window.PLANTAO_SUPABASE_CONFIG
            && window.PLANTAO_SUPABASE_CONFIG.url
            && window.PLANTAO_SUPABASE_CONFIG.anonKey
        );
    }

    async function esperarSupabasePronto() {
        for(let i = 0; i < 28; i += 1) {
            if(supabasePronto()) return true;
            if(typeof window.__plantaoLoadSupabaseFallback === 'function' && i >= 4) {
                try { window.__plantaoLoadSupabaseFallback(); } catch(e) {}
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        return supabasePronto();
    }

    function limparTokensAntigos() {
        try {
            [localStorage, sessionStorage].forEach(storage => {
                Object.keys(storage).forEach(key => {
                    if(key.startsWith('sb-') || key.includes('supabase.auth.token')) {
                        storage.removeItem(key);
                    }
                });
            });
        } catch(e) {}
    }

    function criarClienteOAuth() {
        return window.supabase.createClient(
            window.PLANTAO_SUPABASE_CONFIG.url,
            window.PLANTAO_SUPABASE_CONFIG.anonKey,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    flowType: 'pkce'
                }
            }
        );
    }

    function instalarLoginGoogleSemPreview() {
        if(window.loginGoogle?.__authPreviewGuardWrapped) return true;

        window.loginGoogle = async function loginGoogleSemPreview() {
            instalarEstilo();
            manterTelaLogin();
            setCloudStatus('Abrindo login do Google...');

            if(!await esperarSupabasePronto()) {
                document.body.classList.remove('auth-waiting-google');
                setCloudStatus('Supabase indisponível no momento. Recarregue a página e tente novamente.');
                return;
            }

            try {
                limparTokensAntigos();
                const client = criarClienteOAuth();
                try { await client.auth.signOut({ scope: 'local' }); } catch(e) {}
                sessionStorage.setItem(LOGIN_FLAG, '1');

                const cleanRedirect = `${window.location.origin}${window.location.pathname}`;
                const { error } = await client.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: cleanRedirect,
                        queryParams: { prompt: 'select_account' }
                    }
                });

                if(error) throw error;
            } catch(e) {
                document.body.classList.remove('auth-waiting-google');
                setCloudStatus('Login Google cancelado ou bloqueado pelo navegador.');
            }
        };

        window.loginGoogle.__authPreviewGuardWrapped = true;
        return true;
    }

    function instalar() {
        instalarEstilo();
        liberarTelaLoginQuandoAutorizado();
        instalarLoginGoogleSemPreview();
    }

    instalar();
    const timer = setInterval(() => {
        instalar();
        if(window.loginGoogle?.__authPreviewGuardWrapped && window.ocultarTelaLogin?.__authPreviewGuardWrapped) {
            clearInterval(timer);
        }
    }, 250);
    setTimeout(() => clearInterval(timer), 6000);
})();

(function loadPlantaoSafetyFeatures() {
    if(window.__plantaoSafetyFeaturesRequested) return;
    window.__plantaoSafetyFeaturesRequested = true;
    function load() {
        if(document.querySelector("script[src*='safety-features.js']")) return;
        const script = document.createElement('script');
        script.src = 'safety-features.js?v=202-funcionalidades';
        script.defer = true;
        document.body ? document.body.appendChild(script) : document.head.appendChild(script);
    }
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
    else load();
})();