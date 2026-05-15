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
})();
