window.PLANTAO_SUPABASE_CONFIG = {
  url: 'https://gwcafvegxkxyvgzdzsdu.supabase.co',
  anonKey: 'sb_publishable_V2BXur3TO3bSOSWMK3a1xA_qLZ8xcu3'
};

(function installDataIsolationGuard() {
  if (window.__plantaoDataIsolationGuardInstalled) return;
  window.__plantaoDataIsolationGuardInstalled = true;

  const LEGACY_KEY = 'prf_v120';
  const LOCAL_KEY = 'plantao_db_local_v1';
  const ACTIVE_KEY = 'plantao_active_db_key_v1';
  const USER_PREFIX = 'plantao_db_user_v1_';
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  function safeId(value) {
    return String(value || 'local')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'local';
  }

  function keyForIdentity(identity) {
    return USER_PREFIX + safeId(identity);
  }

  function decodeJwtPayload(token) {
    try {
      const part = String(token || '').split('.')[1];
      if (!part) return null;
      const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const json = decodeURIComponent(
        Array.from(atob(padded), c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function identityFromSupabaseToken() {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('sb-')) continue;
        const raw = originalGetItem.call(localStorage, key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
        const payload = decodeJwtPayload(token);
        if (payload?.sub) return payload.sub;
      }
    } catch (e) {}
    return null;
  }

  function activeDataKey() {
    if (window.__plantaoForcedDataKey) return window.__plantaoForcedDataKey;
    if (window.__plantaoDataIsolationActiveKey) return window.__plantaoDataIsolationActiveKey;
    const saved = originalGetItem.call(localStorage, ACTIVE_KEY);
    if (saved) return saved;
    const tokenIdentity = identityFromSupabaseToken();
    return tokenIdentity ? keyForIdentity(tokenIdentity) : LOCAL_KEY;
  }

  function setActiveIdentity(identity, forced = false) {
    const key = keyForIdentity(identity);
    if (forced) window.__plantaoForcedDataKey = key;
    window.__plantaoDataIsolationActiveKey = key;
    try { originalSetItem.call(localStorage, ACTIVE_KEY, key); } catch (e) {}
    return key;
  }

  function clearActiveIdentity() {
    window.__plantaoForcedDataKey = '';
    window.__plantaoDataIsolationActiveKey = '';
    try { originalRemoveItem.call(localStorage, ACTIVE_KEY); } catch (e) {}
  }

  if (!Storage.prototype.__plantaoDataIsolationPatched) {
    Storage.prototype.getItem = function patchedGetItem(key) {
      if (this === localStorage && key === LEGACY_KEY) {
        return originalGetItem.call(this, activeDataKey());
      }
      return originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function patchedSetItem(key, value) {
      if (this === localStorage && key === LEGACY_KEY) {
        return originalSetItem.call(this, activeDataKey(), value);
      }
      return originalSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      if (this === localStorage && key === LEGACY_KEY) {
        return originalRemoveItem.call(this, activeDataKey());
      }
      return originalRemoveItem.call(this, key);
    };

    Storage.prototype.__plantaoDataIsolationPatched = true;
  }

  function ensureLoadingStyle() {
    if (document.getElementById('plantao-data-isolation-style')) return;
    const style = document.createElement('style');
    style.id = 'plantao-data-isolation-style';
    style.textContent = `
      body.plantao-data-loading .sidebar,
      body.plantao-data-loading .main {
        visibility: hidden;
        pointer-events: none;
      }
      body.plantao-data-loading #login-screen {
        display: flex !important;
      }
    `;
    document.head.appendChild(style);
  }

  function setStatus(text) {
    const el = document.getElementById('cloud-login-status');
    if (el) el.innerText = text;
  }

  function keepBlocked() {
    ensureLoadingStyle();
    document.body?.classList.add('plantao-data-loading');
    const login = document.getElementById('login-screen');
    if (login) login.style.display = 'flex';
  }

  function releaseBlocked() {
    document.body?.classList.remove('plantao-data-loading');
  }

  window.__plantaoSetDataOwner = setActiveIdentity;
  window.__plantaoClearDataOwner = clearActiveIdentity;

  function wrapWhenReady() {
    if (window.__plantaoDataIsolationWrapped) return true;
    if (
      typeof window.ocultarTelaLogin !== 'function' ||
      typeof window.carregarDadosSupabase !== 'function' ||
      typeof window.entrarComSessaoSupabase !== 'function'
    ) {
      return false;
    }

    const originalOcultar = window.ocultarTelaLogin;
    const originalCarregarSupabase = window.carregarDadosSupabase;
    const originalEntrarSessao = window.entrarComSessaoSupabase;
    const originalSair = window.sairGoogle;
    const originalEntrarAluno = window.entrarPerfilAluno;
    const originalVoltarAdmin = window.voltarPerfilAdmin;

    window.__plantaoCloudDataReady = false;

    window.ocultarTelaLogin = function ocultarSomenteComDados() {
      if (!window.__plantaoCloudDataReady) {
        keepBlocked();
        setStatus('Carregando seus dados com segurança...');
        return;
      }
      releaseBlocked();
      return originalOcultar.apply(this, arguments);
    };

    window.carregarDadosSupabase = async function carregarDadosSupabaseIsolado() {
      const result = await originalCarregarSupabase.apply(this, arguments);
      if (result) {
        window.__plantaoCloudDataReady = true;
        releaseBlocked();
        originalOcultar.call(this);
      } else {
        window.__plantaoCloudDataReady = false;
        keepBlocked();
        setStatus('Não foi possível carregar seus dados. Saia e entre novamente para evitar mistura de alunos.');
      }
      return result;
    };

    window.entrarComSessaoSupabase = async function entrarComSessaoSupabaseIsolada(user) {
      window.__plantaoCloudDataReady = false;
      window.__plantaoForcedDataKey = '';
      if (user?.id || user?.email) setActiveIdentity(user.id || user.email);
      keepBlocked();
      return originalEntrarSessao.apply(this, arguments);
    };

    if (typeof originalSair === 'function') {
      window.sairGoogle = async function sairGoogleIsolado() {
        window.__plantaoCloudDataReady = false;
        clearActiveIdentity();
        return originalSair.apply(this, arguments);
      };
    }

    if (typeof originalEntrarAluno === 'function') {
      window.entrarPerfilAluno = async function entrarPerfilAlunoIsolado(email) {
        window.__plantaoCloudDataReady = false;
        setActiveIdentity('aluno-' + String(email || ''), true);
        keepBlocked();
        return originalEntrarAluno.apply(this, arguments);
      };
    }

    if (typeof originalVoltarAdmin === 'function') {
      window.voltarPerfilAdmin = async function voltarPerfilAdminIsolado() {
        window.__plantaoCloudDataReady = false;
        window.__plantaoForcedDataKey = '';
        const tokenIdentity = identityFromSupabaseToken();
        if (tokenIdentity) setActiveIdentity(tokenIdentity);
        keepBlocked();
        return originalVoltarAdmin.apply(this, arguments);
      };
    }

    window.__plantaoDataIsolationWrapped = true;
    return true;
  }

  ensureLoadingStyle();
  const timer = setInterval(() => {
    if (wrapWhenReady()) clearInterval(timer);
  }, 120);
  setTimeout(() => clearInterval(timer), 8000);
})();

(function loadRuntimeFixes() {
  if (window.__plantaoTabletAssetsRequested) return;
  window.__plantaoTabletAssetsRequested = true;

  function addCss() {
    if (document.querySelector(`link[href*='tablet-fix.css']`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'tablet-fix.css?v=195-tablet-scroll';
    document.head.appendChild(link);
  }

  function addScript(src) {
    if (document.querySelector(`script[src*='${src.split('?')[0]}']`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.body ? document.body.appendChild(script) : document.head.appendChild(script);
  }

  function loadAssets() {
    addCss();
    addScript('tablet-fix.js?v=195-tablet-scroll');
    addScript('auth-fix.js?v=196-login-sem-preview');
    addScript('review-dedup-fix.js?v=197-revisao-duplicada');
    addScript('planning-fill-fix.js?v=198-preenche-meta-pendentes');
    setTimeout(() => addScript('launch-fix.js?v=196-launch-history'), 2200);
    setTimeout(() => addScript('ranking-fix.js?v=197-ranking-lancamentos'), 2600);
    window.addEventListener('load', () => {
      setTimeout(() => addScript('launch-fix.js?v=196-launch-history'), 800);
      setTimeout(() => addScript('ranking-fix.js?v=197-ranking-lancamentos'), 1200);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAssets, { once: true });
    addCss();
  } else {
    loadAssets();
  }
})();