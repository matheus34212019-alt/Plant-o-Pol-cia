window.PLANTAO_SUPABASE_CONFIG = {
    url: "https://gwcafvegxkxyvgzdzsdu.supabase.co",
    anonKey: "sb_publishable_V2BXur3TO3bSOSWMK3a1xA_qLZ8xcu3"
};

(function loadTabletFix() {
    if(window.__plantaoTabletAssetsRequested) return;
    window.__plantaoTabletAssetsRequested = true;

    function addCss() {
        if(document.querySelector('link[href*="tablet-fix.css"]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'tablet-fix.css?v=195-tablet-scroll';
        document.head.appendChild(link);
    }

    function addScript() {
        if(document.querySelector('script[src*="tablet-fix.js"]')) return;
        const script = document.createElement('script');
        script.src = 'tablet-fix.js?v=195-tablet-scroll';
        script.defer = true;
        document.body ? document.body.appendChild(script) : document.head.appendChild(script);
    }

    function loadAssets() {
        addCss();
        addScript();
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAssets, { once: true });
        addCss();
    } else {
        loadAssets();
    }
})();
