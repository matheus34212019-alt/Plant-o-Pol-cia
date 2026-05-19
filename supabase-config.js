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

  function findSessionData() {
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

  function identityFromSupabaseToken() {
    return findSessionData()?.payload?.sub || null;
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
      if (this === localStorage && key === LEGACY_KEY) return originalGetItem.call(this, activeDataKey());
      return originalGetItem.call(this, key);
    };
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      if (this === localStorage && key === LEGACY_KEY) return originalSetItem.call(this, activeDataKey(), value);
      return originalSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      if (this === localStorage && key === LEGACY_KEY) return originalRemoveItem.call(this, activeDataKey());
      return originalRemoveItem.call(this, key);
    };
    Storage.prototype.__plantaoDataIsolationPatched = true;
  }

  function defaultData() {
    return {
      lista: [
        { m: "PORTUGUÊS", a: "Compreensão e interpretação de textos", peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 },
        { m: "RACIOCÍNIO LÓGICO", a: "Proposições e conectivos", peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 },
        { m: "DIREITO PENAL", a: "Crimes contra a administração pública", peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 }
      ],
      ciclo: ["PORTUGUÊS", "RACIOCÍNIO LÓGICO", "DIREITO PENAL"],
      h: {1:4, 2:4, 3:4, 4:4, 5:4, 6:4, 0:4},
      metaFixa: {}
    };
  }

  function replaceDb(data) {
    try {
      db = JSON.parse(JSON.stringify(data || defaultData()));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadDbForActiveKey() {
    const raw = originalGetItem.call(localStorage, activeDataKey());
    if (raw) {
      try { return replaceDb(JSON.parse(raw)); } catch (e) {}
    }
    return replaceDb(defaultData());
  }

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
    const materias = Array.isArray(data?.lista)
      ? [...new Set(data.lista.map(item => String(item?.m || '').trim()).filter(Boolean))].slice(0, 6)
      : [];
    return {
      assuntos: Array.isArray(data?.lista) ? data.lista.length : 0,
      materias,
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

  function sameStoredData(a, b) {
    try { return JSON.stringify(a || null) === JSON.stringify(b || null); } catch (e) { return false; }
  }

  function candidateLabel(key) {
    if (key === LEGACY_KEY) return 'dados antigos do navegador';
    if (key === LOCAL_KEY) return 'cópia local separada';
    if (key === activeDataKey()) return 'dados abertos agora';
    return 'cópia local de usuário';
  }

  function allLocalDataCandidates(includeActive = false) {
    const active = activeDataKey();
    const keys = new Set([LEGACY_KEY, LOCAL_KEY]);
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(USER_PREFIX)) keys.add(key);
      }
    } catch (e) {}
    if (!includeActive) keys.delete(active);
    return [...keys]
      .map(key => {
        const data = parseDataFromKey(key);
        return data ? { key, data, score: dataScore(data), summary: dataSummary(data) } : null;
      })
      .filter(item => item && item.score >= 0 && item.summary.assuntos > 0)
      .sort((a, b) => b.score - a.score);
  }

  function recoveryCandidates() {
    const current = parseDataFromKey(activeDataKey());
    return allLocalDataCandidates(false).filter(item => !sameStoredData(item.data, current));
  }

  async function uploadRecoveredData(data) {
    const session = findSessionData();
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
      #plantao-recovery-open {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 99998;
        border: 0;
        border-radius: 10px;
        background: #0891b2;
        color: #fff;
        font: 800 12px/1.2 inherit;
        letter-spacing: 0;
        padding: 12px 14px;
        box-shadow: 0 14px 35px rgba(0,0,0,.35);
        cursor: pointer;
      }
      #plantao-recovery-panel {
        position: fixed;
        left: 18px;
        right: 18px;
        bottom: 72px;
        z-index: 99999;
        background: #0f172a;
        color: #e2e8f0;
        border: 1px solid #38bdf8;
        border-radius: 14px;
        padding: 16px;
        box-shadow: 0 18px 45px rgba(0,0,0,.45);
        font-family: inherit;
        display: grid;
        gap: 12px;
        max-height: min(70vh, 560px);
        overflow: auto;
      }
      .plantao-recovery-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        border-top: 1px solid #334155;
        padding-top: 12px;
      }
      .plantao-recovery-row small {
        color: #cbd5e1;
        display: block;
        margin-top: 4px;
        font-weight: 700;
      }
      .plantao-recovery-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .plantao-recovery-btn {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        background: #0891b2;
        color: white;
        font-weight: 800;
        cursor: pointer;
      }
      .plantao-recovery-secondary {
        border: 1px solid #334155;
        background: transparent;
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

  function candidateText(item) {
    const s = item.summary;
    const materias = s.materias.length ? ` Matérias: ${s.materias.join(', ')}.` : '';
    return `${candidateLabel(item.key)}: ${s.assuntos} assuntos, ${s.dias} dias, ${s.tarefas} cards, ${s.concluidas} concluídos.${materias}`;
  }

  async function restoreCandidate(item, host) {
    const btn = host.querySelector(`[data-restore-key="${CSS.escape(item.key)}"]`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'RESTAURANDO...';
    }
    originalSetItem.call(localStorage, activeDataKey(), JSON.stringify(item.data));
    replaceDb(item.data);
    try {
      if (typeof normalizarBanco === 'function') normalizarBanco();
      await uploadRecoveredData(item.data);
      host.innerHTML = '<strong>Dados restaurados.</strong><span>Vou recarregar a página para abrir seu planejamento.</span>';
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'TENTAR NOVAMENTE';
      }
      const msg = document.createElement('span');
      msg.textContent = 'A cópia foi recolocada neste navegador, mas não consegui enviar para a nuvem agora.';
      host.appendChild(msg);
    }
  }

  function openRecoveryPanel(auto = false) {
    ensureLoadingStyle();
    document.getElementById('plantao-recovery-panel')?.remove();
    const panel = document.createElement('div');
    panel.id = 'plantao-recovery-panel';
    const candidates = recoveryCandidates();
    const active = parseDataFromKey(activeDataKey());
    const activeSummary = dataSummary(active);

    if (!candidates.length) {
      panel.innerHTML = `
        <strong>Não encontrei cópia antiga diferente neste navegador</strong>
        <span>Dados abertos agora: ${activeSummary.assuntos} assuntos, ${activeSummary.dias} dias, ${activeSummary.tarefas} cards.</span>
        <span>Se suas matérias foram criadas em outro aparelho, outro navegador ou antes do login atual, a recuperação precisa ser feita pelo Supabase/backups.</span>
        <div class="plantao-recovery-actions">
          <button type="button" class="plantao-recovery-btn plantao-recovery-secondary" id="plantao-recovery-close">FECHAR</button>
        </div>`;
      document.body.appendChild(panel);
      panel.querySelector('#plantao-recovery-close').onclick = () => panel.remove();
      return;
    }

    panel.innerHTML = `
      <strong>${auto ? 'Encontrei possível cópia dos seus dados' : 'Cópias encontradas neste navegador'}</strong>
      <span>Escolha a cópia que tem suas matérias cadastradas. A restauração salva essa cópia na conta que está logada agora.</span>
      <div id="plantao-recovery-list"></div>
      <div class="plantao-recovery-actions">
        <button type="button" class="plantao-recovery-btn plantao-recovery-secondary" id="plantao-recovery-close">FECHAR</button>
      </div>`;
    const list = panel.querySelector('#plantao-recovery-list');
    candidates.forEach(item => {
      const row = document.createElement('div');
      row.className = 'plantao-recovery-row';
      row.innerHTML = `
        <div>
          <strong>${candidateText(item)}</strong>
          <small>Chave local: ${item.key}</small>
        </div>
        <button type="button" class="plantao-recovery-btn" data-restore-key="${item.key}">RESTAURAR</button>`;
      list.appendChild(row);
      row.querySelector('button').onclick = () => restoreCandidate(item, panel);
    });
    document.body.appendChild(panel);
    panel.querySelector('#plantao-recovery-close').onclick = () => panel.remove();
  }

  function ensureRecoveryButton() {
    if (!document.body || document.getElementById('plantao-recovery-open')) return;
    ensureLoadingStyle();
    const button = document.createElement('button');
    button.id = 'plantao-recovery-open';
    button.type = 'button';
    button.textContent = 'RECUPERAR DADOS';
    button.onclick = () => openRecoveryPanel(false);
    document.body.appendChild(button);
  }

  function showRecoveryIfUseful() {
    ensureRecoveryButton();
    const currentScore = dataScore(parseDataFromKey(activeDataKey()));
    const candidate = recoveryCandidates().find(item => item.score > currentScore + 2 || item.score > 2);
    if (candidate) openRecoveryPanel(true);
  }

  function hasBetterLocalCopyThanRuntime() {
    const currentScore = dataScore(parseDataFromKey(activeDataKey()));
    return recoveryCandidates().some(item => item.score > currentScore + 2 && item.score > 2);
  }

  window.__plantaoSetDataOwner = setActiveIdentity;
  window.__plantaoClearDataOwner = clearActiveIdentity;
  window.__plantaoGetActiveDataKey = activeDataKey;
  window.__plantaoReadRawStorageKey = key => originalGetItem.call(localStorage, key);
  window.__plantaoWriteRawStorageKey = (key, value) => originalSetItem.call(localStorage, key, value);
  window.__plantaoPrepareUserData = identity => {
    if (identity) setActiveIdentity(identity);
    return loadDbForActiveKey();
  };
  window.__plantaoOpenRecoveryPanel = () => openRecoveryPanel(false);

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
        setStatus('Carregando seus dados com segurança...');
        return;
      }
      releaseBlocked();
      return originalOcultar.apply(this, arguments);
    };

    window.carregarDadosSupabase = async function carregarDadosSupabaseSeguro() {
      const result = await originalCarregarSupabase.apply(this, arguments);
      setTimeout(showRecoveryIfUseful, 500);
      if (result) {
        window.__plantaoCloudDataReady = true;
        releaseBlocked();
        originalOcultar.call(this);
      } else {
        window.__plantaoCloudDataReady = false;
        keepBlocked();
        setStatus('Não foi possível carregar seus dados. Use Recuperar Dados ou entre novamente.');
        ensureRecoveryButton();
      }
      return result;
    };

    if (typeof originalSalvarSupabase === 'function') {
      window.salvarDadosSupabase = async function salvarDadosSupabaseSeguro() {
        if (hasBetterLocalCopyThanRuntime()) {
          showRecoveryIfUseful();
          setStatus('Bloqueei o salvamento porque encontrei uma cópia local mais completa.');
          return;
        }
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
    setTimeout(showRecoveryIfUseful, 1800);
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