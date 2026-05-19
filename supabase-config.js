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
  window.__plantaoGetActiveDataKey = activeDataKey;
  window.__plantaoReadRawStorageKey = key => originalGetItem.call(localStorage, key);
  window.__plantaoWriteRawStorageKey = (key, value) => originalSetItem.call(localStorage, key, value);

  function parseDataFromKey(key) {
    try {
      const raw = originalGetItem.call(localStorage, key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function dataSummary(data) {
    const meta = data?.metaFixa && typeof data.metaFixa === 'object' ? data.metaFixa : {};
    const tasks = Object.values(meta).flat().filter(Boolean);
    return {
      assuntos: Array.isArray(data?.lista) ? data.lista.length : 0,
      dias: Object.keys(meta).length,
      tarefas: tasks.length,
      concluidas: tasks.filter(t => t?.c === true).length,
      lancamentos: Array.isArray(data?.lancamentos) ? data.lancamentos.length : 0
    };
  }

  function dataScore(data) {
    const s = dataSummary(data);
    return Math.max(0, s.assuntos - 3) + (s.dias * 2) + (s.tarefas * 3) + (s.concluidas * 5) + (s.lancamentos * 5);
  }

  function candidateLabel(key) {
    if (key === LEGACY_KEY) return 'dados antigos do navegador';
    if (key === LOCAL_KEY) return 'cópia local separada';
    return 'cópia local de usuário';
  }

  function localRecoveryCandidates() {
    const active = activeDataKey();
    const keys = new Set([LEGACY_KEY, LOCAL_KEY]);
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(USER_PREFIX)) keys.add(key);
      }
    } catch (e) {}
    keys.delete(active);
    return [...keys]
      .map(key => {
        const data = parseDataFromKey(key);
        return data ? { key, data, score: dataScore(data), summary: dataSummary(data) } : null;
      })
      .filter(item => item && item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  function findCurrentSessionData() {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('sb-')) continue;
        const raw = originalGetItem.call(localStorage, key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
        const payload = decodeJwtPayload(token);
        if (token && payload?.sub) return { token, payload };
      }
    } catch (e) {}
    return null;
  }

  async function uploadRecoveredData(data) {
    const session = findCurrentSessionData();
    if (!session || !window.supabase?.createClient) return false;
    const client = window.supabase.createClient(
      window.PLANTAO_SUPABASE_CONFIG.url,
      window.PLANTAO_SUPABASE_CONFIG.anonKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${session.token}` } }
      }
    );
    const { error } = await client
      .from('plantao_user_data')
      .upsert({
        user_id: session.payload.sub,
        email: session.payload.email || null,
        data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    if (error) throw error;
    return true;
  }

  function showLocalRecoveryIfNeeded() {
    if (document.getElementById('plantao-local-recovery')) return;
    const current = parseDataFromKey(activeDataKey());
    const currentScore = dataScore(current);
    const candidate = localRecoveryCandidates().find(item => item.score > currentScore + 2);
    if (!candidate) return;

    const s = candidate.summary;
    const banner = document.createElement('div');
    banner.id = 'plantao-local-recovery';
    banner.style.cssText = 'position:fixed;left:18px;right:18px;bottom:18px;z-index:100000;background:#0f172a;color:#e2e8f0;border:1px solid #38bdf8;border-radius:14px;padding:16px;box-shadow:0 18px 45px rgba(0,0,0,.45);font-family:inherit;display:grid;gap:10px;';
    banner.innerHTML = `
      <strong>Encontrei uma cópia mais completa neste navegador</strong>
      <span>${candidateLabel(candidate.key)}: ${s.assuntos} assuntos, ${s.dias} dias, ${s.tarefas} cards, ${s.concluidas} concluídos.</span>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" id="plantao-restore-local" style="border:0;border-radius:10px;padding:10px 14px;background:#0891b2;color:white;font-weight:800;cursor:pointer;">RESTAURAR MEUS DADOS</button>
        <button type="button" id="plantao-ignore-local" style="border:1px solid #334155;border-radius:10px;padding:10px 14px;background:transparent;color:#e2e8f0;font-weight:800;cursor:pointer;">IGNORAR</button>
      </div>`;
    document.body.appendChild(banner);

    document.getElementById('plantao-ignore-local').onclick = () => banner.remove();
    document.getElementById('plantao-restore-local').onclick = async () => {
      const btn = document.getElementById('plantao-restore-local');
      btn.disabled = true;
      btn.textContent = 'RESTAURANDO...';
      try {
        originalSetItem.call(localStorage, activeDataKey(), JSON.stringify(candidate.data));
        await uploadRecoveredData(candidate.data);
        banner.innerHTML = '<strong>Dados restaurados.</strong><span>Vou recarregar a página para abrir seu planejamento.</span>';
        setTimeout(() => window.location.reload(), 900);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'TENTAR NOVAMENTE';
        const msg = document.createElement('span');
        msg.textContent = 'Não consegui enviar para a nuvem agora, mas a cópia foi mantida neste navegador.';
        banner.appendChild(msg);
      }
    };
  }

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
      setTimeout(showLocalRecoveryIfNeeded, 700);
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

  document.addEventListener('DOMContentLoaded', () => {
    ensureLoadingStyle();
    keepBlocked();
    wrapWhenReady();
    setTimeout(showLocalRecoveryIfNeeded, 1800);
  }, { once: true, capture: true });

  if (document.body) keepBlocked();
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