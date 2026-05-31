(function tabletFix(){
    if(window.__plantaoTabletFixLoaded) return;
    window.__plantaoTabletFixLoaded = true;

    function scrollActiveTabToTop(){
        const targets = [document.querySelector('.main'), document.scrollingElement, document.documentElement, document.body];
        targets.forEach(el => {
            if(!el) return;
            if(typeof el.scrollTo === 'function') {
                el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                return;
            }
            el.scrollTop = 0;
            el.scrollLeft = 0;
        });
    }

    function install(){
        const current = window.showTab;
        if(typeof current !== 'function' || current.__tabletScrollFixV277) return;
        function showTabComRolagemCorrigida(){
            const result = current.apply(this, arguments);
            requestAnimationFrame(scrollActiveTabToTop);
            return result;
        }
        showTabComRolagemCorrigida.__tabletScrollFixV277 = true;
        showTabComRolagemCorrigida.__original = current;
        window.showTab = showTabComRolagemCorrigida;
    }

    install();
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    setTimeout(install, 500);
    window.__plantaoScrollActiveTabToTop = scrollActiveTabToTop;
})();
