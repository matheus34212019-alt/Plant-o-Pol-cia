window.PLANTAO_SUPABASE_CONFIG = {
  url: 'https://gwcafvegxkxyvgzdzsdu.supabase.co',
  anonKey: 'sb_publishable_V2BXur3TO3bSOSWMK3a1xA_qLZ8xcu3'
};

(function installPlantaoDataSafety() {
  if (window.__plantaoDataSafetyInstalled) return;
  window.__plantaoDataSafetyInstalled = true;

  const LEGACY_KEY = 'prf_v120';
  const LOCAL_KEY = 'plantao_db_local_v1';
  const ACTIVE_KEY = 'plantao_active_db_key_v1';
  const USER_PREFIX = 'plantao_db_user_v1_';
  const STUDENT_PREFIX = USER_PREFIX + 'aluno-';

  const rawGetItem = Storage.prototype.getItem;
  const rawSetItem = Storage.prototype.setItem;
  const rawRemoveItem = Storage.prototype.removeItem;
  const rawKey = Storage.prototype.key;

  function safeId(value) {
    return String(value || 'local')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'local';
  }

  function keyForIdentity(identity) {
    return USER_PREFIX + safeId(identity);
  }

  function isStudentKey(key) {
    return String(key || '').startsWith(STUDENT_PREFIX);
  }

  function rawGet(key) {
    try { return rawGetItem.call(localStorage, key); } catch (e) { return null; }
  }

  function rawSet(key, value) {
    try { return rawSetItem.call(localStorage, key, value); } catch (e) {}
  }

  function rawRemove(key) {
    try { return rawRemoveItem.call(localStorage, key); } catch (e) {}
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

  function findSessionData() {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = rawKey.call(localStorage, i);
        if (!key || !key.startsWith('sb-')) continue;
        const raw = rawGet(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
        const payload = decodeJwtPayload(token);
        if (token && payload?.sub) return { token, payload };
      }
    } catch (e) {}
    return null;
  }

  function identityFromSupabaseToken() {
    return findSessionData()?.payload?.sub || null;
  }

  function mainDataKey() {
    const tokenIdentity = identityFromSupabaseToken();
    if (tokenIdentity) return keyForIdentity(tokenIdentity);
    const saved = rawGet(ACTIVE_KEY);
    if (saved && !isStudentKey(saved)) return saved;
    if (isStudentKey(saved)) rawRemove(ACTIVE_KEY);
    return LOCAL_KEY;
  }

  function activeDataKey() {
    if (window.__plantaoForcedDataKey) return window.__plantaoForcedDataKey;
    const memory = window.__plantaoDataIsolationActiveKey;
    if (memory && !isStudentKey(memory)) return memory;
    return mainDataKey();
  }

  function persistMainKey(key) {
    if (key && !isStudentKey(key)) rawSet(ACTIVE_KEY, key);
  }

  function setActiveIdentity(identity, forced = false) {
    const key = keyForIdentity(identity);
    if (forced) {
      window.__plantaoForcedDataKey = key;
      window.__plantaoDataIsolationActiveKey = key;
      persistMainKey(mainDataKey());
      return key;
    }
    window.__plantaoForcedDataKey = '';
    window.__plantaoDataIsolationActiveKey = key;
    persistMainKey(key);
    return key;
  }

  function clearActiveIdentity() {
    window.__plantaoForcedDataKey = '';
    window.__plantaoDataIsolationActiveKey = '';
    rawRemove(ACTIVE_KEY);
  }

  function patchStorage() {
    if (Storage.prototype.__plantaoDataIsolationPatchedV208) return;
    Storage.prototype.getItem = function patchedGetItem(key) {
      if (this === localStorage && key === LEGACY_KEY) return rawGet(activeDataKey());
      return rawGetItem.call(this, key);
    };
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      if (this === localStorage && key === LEGACY_KEY) return rawSet(activeDataKey(), value);
      if (this === localStorage && key === ACTIVE_KEY && isStudentKey(value) && !window.__plantaoForcedDataKey) {
        return persistMainKey(mainDataKey());
      }
      return rawSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      if (this === localStorage && key === LEGACY_KEY) return rawRemove(activeDataKey());
      return rawRemoveItem.call(this, key);
    };
    Storage.prototype.__plantaoDataIsolationPatched = true;
    Storage.prototype.__plantaoDataIsolationPatchedV208 = true;
  }

  function defaultData() {
    return {
      lista: [
        { m: 'PORTUGUES', a: 'Compreensao e interpretacao de textos', peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 },
        { m: 'RACIOCINIO LOGICO', a: 'Proposicoes e conectivos', peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 },
        { m: 'DIREITO PENAL', a: 'Crimes contra a administracao publica', peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 }
      ],
      ciclo: ['PORTUGUES', 'RACIOCINIO LOGICO', 'DIREITO PENAL'],
      h: {1:4, 2:4, 3:4, 4:4, 5:4, 6:4, 0:4},
      metaFixa: {}
    };
  }

  function clone(data) {
    return JSON.parse(JSON.stringify(data || defaultData()));
  }

  function replaceDb(data) {
    try {
      db = clone(data || defaultData());
      return true;
    } catch (e) {
      return false;
    }
  }

  function parseDataFromKey(key) {
    try {
      const raw = rawGet(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function dataSummary(data) {
    const meta = data?.metaFixa && typeof data.metaFixa === 'object' ? data.metaFixa : {};
    const tasks = Object.values(meta).flat().filter(Boolean);
    const list = Array.isArray(data?.lista) ? data.lista : [];
    return {
      assuntos: list.length,
      materias: [...new Set(list.map(item => String(item?.m || '').trim()).filter(Boolean))].slice(0, 6),
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

  function isStarterData(data) {
    const list = Array.isArray(data?.lista) ? data.lista : [];
    if (!list.length || list.length > 3) return false;
    const seedSubjects = new Set(['portugues', 'raciocinio logico', 'direito penal']);
    const normalized = list
      .map(item => String(item?.m || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim())
      .filter(Boolean);
    return normalized.length > 0 && normalized.every(name => seedSubjects.has(name));
  }

  function sameStoredData(a, b) {
    try { return JSON.stringify(a || null) === JSON.stringify(b || null); } catch (e) { return false; }
  }

  function allLocalDataCandidates(includeActive = false) {
    const active = activeDataKey();
    const keys = new Set([LEGACY_KEY, LOCAL_KEY]);
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = rawKey.call(localStorage, i);
        if (!key || !key.startsWith(USER_PREFIX)) continue;
        if (isStudentKey(key) && window.__plantaoForcedDataKey !== key) continue;
        keys.add(key);
      }
    } catch (e) {}
    if (!includeActive) keys.delete(active);
    return [...keys]
      .map(key => {
        const data = parseDataFromKey(key);
        return data ? { key, data, score: dataScore(data), summary: dataSummary(data) } : null;
      })
      .filter(item => item && item.summary.assuntos > 0)
      .sort((a, b) => b.score - a.score);
  }

  function bestSilentRecoveryCandidate(current) {
    const currentScore = dataScore(current);
    if (currentScore > 2 && !isStarterData(current)) return null;
    return allLocalDataCandidates(false).find(item => item.score > currentScore) || null;
  }

  function loadDbForActiveKey() {
    const key = activeDataKey();
    const raw = rawGet(key);
    if (raw) {
      try {
        const current = JSON.parse(raw);
        if (dataScore(current) > 2) return replaceDb(current);
        const candidate = bestSilentRecoveryCandidate(current);
        if (candidate) {
          rawSet(key, JSON.stringify(candidate.data));
          return replaceDb(candidate.data);
        }
        return replaceDb(current);
      } catch (e) {}
    }
    const candidate = bestSilentRecoveryCandidate(null);
    if (candidate) {
      rawSet(key, JSON.stringify(candidate.data));
      return replaceDb(candidate.data);
    }
    return replaceDb(defaultData());
  }

  function silentAutoRestoreIfNeeded() {
    const key = activeDataKey();
    const current = parseDataFromKey(key);
    const candidate = bestSilentRecoveryCandidate(current);
    if (!candidate) return false;
    rawSet(key, JSON.stringify(candidate.data));
    replaceDb(candidate.data);
    try { if (typeof normalizarBanco === 'function') normalizarBanco(); } catch (e) {}
    return true;
  }

  async function restoreRemoteIfRicher() {
    try {
      if (
        typeof supabaseClient === 'undefined' ||
        typeof cloudUser === 'undefined' ||
        !supabaseClient ||
        !cloudUser ||
        typeof alvoDadosNuvem !== 'function'
      ) {
        return false;
      }
      const alvo = alvoDadosNuvem();
      if (!alvo?.user_id) return false;
      const { data, error } = await supabaseClient
        .from('plantao_user_data')
        .select('data')
        .eq('user_id', alvo.user_id)
        .maybeSingle();
      if (error || !data?.data) return false;
      const remote = data.data;
      const shouldRestore = typeof salvariaPerdaCritica === 'function'
        ? salvariaPerdaCritica(db, remote)
        : dataScore(remote) > dataScore(db);
      if (!shouldRestore && !isStarterData(db)) return false;

      replaceDb(remote);
      rawSet(activeDataKey(), JSON.stringify(db));
      try { dadosSupabaseCarregados = true; } catch (e) {}
      try { carregandoNuvem = true; } catch (e) {}
      try { if (typeof normalizarBanco === 'function') normalizarBanco(); } catch (e) {}
      try { carregandoNuvem = false; } catch (e) {}
      rawSet(activeDataKey(), JSON.stringify(db));
      try { if (typeof init === 'function') init(); } catch (e) {}
      return true;
    } catch (e) {
      try { carregandoNuvem = false; } catch (_) {}
      return false;
    }
  }

  function ensureLoadingStyle() {
    if (document.getElementById('plantao-data-safety-style')) return;
    const style = document.createElement('style');
    style.id = 'plantao-data-safety-style';
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

  patchStorage();
  persistMainKey(mainDataKey());

  window.__plantaoSetDataOwner = setActiveIdentity;
  window.__plantaoClearDataOwner = clearActiveIdentity;
  window.__plantaoGetActiveDataKey = activeDataKey;
  window.__plantaoReadRawStorageKey = rawGet;
  window.__plantaoWriteRawStorageKey = rawSet;
  window.__plantaoPrepareUserData = identity => {
    if (identity) setActiveIdentity(identity);
    return loadDbForActiveKey();
  };
  window.__plantaoRecoverSilently = silentAutoRestoreIfNeeded;

  function wrapWhenReady() {
    if (window.__plantaoDataSafetyWrapped) return true;
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
    const originalSalvarSupabase = window.salvarDadosSupabase;
    const originalSair = window.sairGoogle;
    const originalEntrarAluno = window.entrarPerfilAluno;
    const originalVoltarAdmin = window.voltarPerfilAdmin;
    window.__plantaoCloudDataReady = false;

    window.ocultarTelaLogin = function ocultarSomenteComDados() {
      if (!window.__plantaoCloudDataReady) {
        keepBlocked();
        setStatus('Carregando seus dados com seguranca...');
        return;
      }
      releaseBlocked();
      return originalOcultar.apply(this, arguments);
    };

    window.carregarDadosSupabase = async function carregarDadosSupabaseSeguro() {
      const result = await originalCarregarSupabase.apply(this, arguments);
      setTimeout(silentAutoRestoreIfNeeded, 500);
      if (result) {
        window.__plantaoCloudDataReady = true;
        releaseBlocked();
        originalOcultar.call(this);
      } else {
        window.__plantaoCloudDataReady = false;
        keepBlocked();
        silentAutoRestoreIfNeeded();
        setStatus('Nao foi possivel carregar seus dados da nuvem agora. Seus dados locais desta conta continuam preservados.');
      }
      return result;
    };

    if (typeof originalSalvarSupabase === 'function') {
      window.salvarDadosSupabase = async function salvarDadosSupabaseSeguro() {
        silentAutoRestoreIfNeeded();
        if (await restoreRemoteIfRicher()) return;
        return originalSalvarSupabase.apply(this, arguments);
      };
    }

    window.entrarComSessaoSupabase = async function entrarComSessaoSupabaseSeguro(user) {
      window.__plantaoCloudDataReady = false;
      window.__plantaoForcedDataKey = '';
      if (user?.id || user?.email) {
        setActiveIdentity(user.id || user.email);
        loadDbForActiveKey();
      }
      keepBlocked();
      return originalEntrarSessao.apply(this, arguments);
    };

    if (typeof originalSair === 'function') {
      window.sairGoogle = async function sairGoogleSeguro() {
        window.__plantaoCloudDataReady = false;
        clearActiveIdentity();
        return originalSair.apply(this, arguments);
      };
    }

    if (typeof originalEntrarAluno === 'function') {
      window.entrarPerfilAluno = async function entrarPerfilAlunoSeguro(email) {
        window.__plantaoCloudDataReady = false;
        setActiveIdentity('aluno-' + String(email || ''), true);
        loadDbForActiveKey();
        keepBlocked();
        return originalEntrarAluno.apply(this, arguments);
      };
    }

    if (typeof originalVoltarAdmin === 'function') {
      window.voltarPerfilAdmin = async function voltarPerfilAdminSeguro() {
        window.__plantaoCloudDataReady = false;
        window.__plantaoForcedDataKey = '';
        const tokenIdentity = identityFromSupabaseToken();
        if (tokenIdentity) setActiveIdentity(tokenIdentity);
        else persistMainKey(mainDataKey());
        loadDbForActiveKey();
        keepBlocked();
        return originalVoltarAdmin.apply(this, arguments);
      };
    }

    window.__plantaoDataSafetyWrapped = true;
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureLoadingStyle();
    keepBlocked();
    wrapWhenReady();
    setTimeout(silentAutoRestoreIfNeeded, 1800);
  }, { once: true, capture: true });

  if (document.body) keepBlocked();
  ensureLoadingStyle();
  const timer = setInterval(() => {
    if (wrapWhenReady()) clearInterval(timer);
  }, 120);
  setTimeout(() => clearInterval(timer), 8000);
})();

(function loadRuntimeFixes() {
  if (window.__plantaoRuntimeAssetsRequested) return;
  window.__plantaoRuntimeAssetsRequested = true;

  function addCss() {
    if (document.querySelector("link[href*='tablet-fix.css']")) return;
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
    addScript('account-isolation-fix.js?v=208-contas');
    addScript('auth-fix.js?v=208-contas');
    addScript('review-dedup-fix.js?v=197-revisao-duplicada');
    addScript('planning-fill-fix.js?v=198-preenche-meta-pendentes');
    addScript('safety-features.js?v=203-estabilidade');
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