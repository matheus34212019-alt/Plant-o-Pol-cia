(function plantaoProfileNavFix() {
    if(window.__plantaoProfileNavFix) return;
    window.__plantaoProfileNavFix = true;

    const VERSION = 'v220-profile-nav';

    function qs(selector, root = document) {
        try { return root.querySelector(selector); } catch(_) { return null; }
    }

    function qsa(selector, root = document) {
        try { return Array.from(root.querySelectorAll(selector)); } catch(_) { return []; }
    }

    function profileNavTemplate() {
        const item = document.createElement('div');
        item.className = 'nav-item';
        item.setAttribute('onclick', "showTab('perfil', this)");
        item.innerHTML = '<i class="fas fa-user-circle"></i><span>Meu Perfil</span>';
        return item;
    }

    function restoreProfileNav() {
        const sidebar = qs('.sidebar');
        if(!sidebar) return null;

        let item = qs(".nav-item[onclick*=\"perfil\"], [data-tab-target=\"perfil\"]", sidebar);
        if(!item) {
            item = profileNavTemplate();
            const plan = qs(".nav-item[onclick*=\"toggleSub\"]", sidebar);
            const ranking = qs('#ranking-nav', sidebar);
            if(plan) sidebar.insertBefore(item, plan);
            else if(ranking?.nextSibling) sidebar.insertBefore(item, ranking.nextSibling);
            else sidebar.appendChild(item);
        }

        item.classList.remove('admin-only');
        item.removeAttribute('hidden');
        item.removeAttribute('aria-hidden');
        item.dataset.tabTarget = 'perfil';
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-controls', 'perfil');
        item.style.display = 'flex';
        item.style.visibility = 'visible';
        item.style.opacity = '1';
        item.style.pointerEvents = 'auto';

        const label = qs('span', item);
        if(label) label.textContent = 'Meu Perfil';
        return item;
    }

    function restoreProfilePageIfActive() {
        const page = qs('#perfil');
        if(!page) return;
        const active = page.classList.contains('active') || document.documentElement.dataset.activeTab === 'perfil';
        if(!active) return;
        page.removeAttribute('hidden');
        page.removeAttribute('aria-hidden');
        page.style.display = '';
        if(typeof window.renderPerfil === 'function') {
            try { window.renderPerfil(); } catch(error) { console.warn('[PLANTAO] renderPerfil protegido:', error); }
        }
    }

    function ensureProfile(reason = 'check') {
        restoreProfileNav();
        restoreProfilePageIfActive();
        document.documentElement.dataset.profileNavFix = VERSION;
        document.documentElement.dataset.profileNavReason = reason;
    }

    function wrap(name, after) {
        const original = window[name];
        if(typeof original !== 'function' || original.__plantaoProfileNavFix) return;
        window[name] = function wrappedProfileNavFix() {
            const result = original.apply(this, arguments);
            setTimeout(() => after(arguments, result), 0);
            return result;
        };
        window[name].__plantaoProfileNavFix = true;
        window[name].__plantaoOriginal = original;
    }

    function install() {
        ensureProfile('install');

        wrap('showTab', (args) => {
            ensureProfile(args?.[0] === 'perfil' ? 'show-perfil' : 'show-tab');
        });
        wrap('init', () => ensureProfile('init'));
        wrap('renderPerfil', () => ensureProfile('render-perfil'));
        wrap('ocultarTelaLogin', () => ensureProfile('login'));

        const sidebar = qs('.sidebar');
        if(sidebar && !sidebar.__plantaoProfileNavObserver) {
            sidebar.__plantaoProfileNavObserver = true;
            const observer = new MutationObserver(() => ensureProfile('sidebar-change'));
            observer.observe(sidebar, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'] });
        }

        qsa('.nav-item, .sub-link').forEach(item => {
            if(item.dataset.profileNavClickReady) return;
            item.dataset.profileNavClickReady = '1';
            item.addEventListener('click', () => setTimeout(() => ensureProfile('nav-click'), 0), true);
        });
    }

    window.plantaoEnsureProfileNav = ensureProfile;

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
    window.addEventListener('load', () => ensureProfile('load'));
    setTimeout(() => ensureProfile('late-500'), 500);
    setTimeout(() => ensureProfile('late-1500'), 1500);
})();
