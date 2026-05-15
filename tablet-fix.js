(function tabletFix() {
    if(window.__plantaoTabletFixLoaded) return;
    window.__plantaoTabletFixLoaded = true;

    function scrollActiveTabToTop() {
        const alvos = [
            document.querySelector('.main'),
            document.scrollingElement,
            document.documentElement,
            document.body
        ];

        alvos.forEach(el => {
            if(!el) return;
            if(typeof el.scrollTo === 'function') {
                el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                return;
            }
            el.scrollTop = 0;
            el.scrollLeft = 0;
        });
    }

    const originalShowTab = window.showTab;
    if(typeof originalShowTab === 'function') {
        window.showTab = function showTabComRolagemCorrigida() {
            const result = originalShowTab.apply(this, arguments);
            requestAnimationFrame(scrollActiveTabToTop);
            return result;
        };
    }

    window.__plantaoScrollActiveTabToTop = scrollActiveTabToTop;

    if(!document.querySelector('script[src*="auth-fix.js"]')) {
        const script = document.createElement('script');
        script.src = 'auth-fix.js?v=196-login-sem-preview';
        script.defer = true;
        document.body ? document.body.appendChild(script) : document.head.appendChild(script);
    }

    if(!document.querySelector('script[src*="review-dedup-fix.js"]')) {
        const script = document.createElement('script');
        script.src = 'review-dedup-fix.js?v=197-revisao-duplicada';
        script.defer = true;
        document.body ? document.body.appendChild(script) : document.head.appendChild(script);
    }
})();
