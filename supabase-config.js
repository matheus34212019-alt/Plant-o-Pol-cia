window.PLANTAO_SUPABASE_CONFIG = {
    url: "https://gwcafvegxkxyvgzdzsdu.supabase.co",
    anonKey: "sb_publishable_V2BXur3TO3bSOSWMK3a1xA_qLZ8xcu3"
};

(function plantaoSafeVisualFixes() {
    const APP_NAME = 'PLANT' + String.fromCharCode(0x00c3) + 'O';

    function injectPolish() {
        if (document.querySelector('link[href*="app-polish.css"]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'app-polish.css?v=151';
        document.head.appendChild(link);
    }

    function fixBrand() {
        if (!document.body) return;
        document.title = APP_NAME;
        document.body.classList.add('plantao-polished');
        document.querySelectorAll('.login-card h2').forEach(el => { el.textContent = APP_NAME; });
        document.querySelectorAll('.logo-box').forEach(el => {
            const icon = el.querySelector('i')?.outerHTML || '<i class="fas fa-shield-halved"></i>';
            el.innerHTML = `${icon} ${APP_NAME}`;
        });
    }

    function boot() {
        injectPolish();
        fixBrand();
        setTimeout(fixBrand, 300);
        setTimeout(fixBrand, 1200);
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
