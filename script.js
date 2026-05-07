let db = JSON.parse(localStorage.getItem('prf_v120')) || {
    lista: [
        { m: "PORTUGUÊS", a: "Compreensão e interpretação de textos", peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 },
        { m: "RACIOCÍNIO LÓGICO", a: "Proposições e conectivos", peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 },
        { m: "DIREITO PENAL", a: "Crimes contra a administração pública", peso: 1, h: {E:1.5, Rev:1, Ex:1}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 }
    ],
    ciclo: ["PORTUGUÊS", "RACIOCÍNIO LÓGICO", "DIREITO PENAL"],
    h: {1:4, 2:4, 3:4, 4:4, 5:4, 6:4, 0:4},
    metaFixa: {}
};

let vDate = new Date();
let timers = {};
let exPendente = null;
let teoriaPendente = null;
let firebaseApp = null;
let firebaseAuth = null;
let firebaseStore = null;
let supabaseClient = null;
let supabaseAccessToken = null;
let cloudUser = null;
let cloudSaveTimer = null;
let carregandoNuvem = false;
let accessProfile = null;
let adminAccessList = [];
let adminStudentContext = null;
let adminEditBackupReady = false;
let authProcessandoRetorno = false;
let modoRecuperacaoSenha = false;

const ADMIN_EMAIL = 'matheus34212019@gmail.com';
const ACCESS_TABLE = 'plantao_user_access';
const revisoesIntervalos = [3, 7, 21];
const MAX_ESTUDO_DIA = 2;
const limitarPeso = valor => Math.min(5, Math.max(1, parseInt(valor || 1)));
const safeId = texto => String(texto).replace(/[^a-z0-9]/gi, '-');
const isExtraTask = task => task?.extra === true || task?.l === 'Extra';
const tarefasPlanejadas = tasks => (tasks || []).filter(t => !isExtraTask(t));
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function corrigirMojibakeValor(valor) {
    if(typeof valor !== 'string') return valor;
    const trocas = [
        ['Ãƒ', 'Ã'],
        ['Ã¡', 'á'], ['Ãà', 'à'], ['Ã¢', 'â'], ['Ã£', 'ã'], ['Ã©', 'é'], ['Ãª', 'ê'],
        ['Ã­', 'í'], ['Ã³', 'ó'], ['Ã´', 'ô'], ['Ãµ', 'õ'], ['Ãº', 'ú'], ['Ã§', 'ç'],
        ['ÃÁ', 'Á'], ['ÃÉ', 'É'], ['ÃÍ', 'Í'], ['ÃÓ', 'Ó'], ['ÃÚ', 'Ú'], ['Ã‡', 'Ç'],
        ['Ã‡', 'Ç'], ['Ã“', 'Ó'], ['Ã‰', 'É'], ['ÃŠ', 'Ê'], ['Ãš', 'Ú'],
        ['Âº', 'º'], ['Âª', 'ª'], ['Â·', '·'], ['Â', ''],
        ['â€“', '-'], ['â€”', '-'], ['â€˜', "'"], ['â€™', "'"], ['â€œ', '"'], ['â€', '"'],
        ['ðŸš“', '']
    ];
    let texto = valor;
    for(let i = 0; i < 3; i++) {
        trocas.forEach(([de, para]) => {
            texto = texto.split(de).join(para);
        });
    }
    const ortografia = [
        ['PLANTAO', 'PLANTÃO'], ['Plantao', 'Plantão'], ['plantao', 'plantão'],
        ['MISSAO', 'MISSÃO'], ['Missao', 'Missão'], ['missao', 'missão'],
        ['FORCA', 'FORÇA'], ['Forca', 'Força'], ['forca', 'força'],
        ['AMANHA', 'AMANHÃ'], ['Amanha', 'Amanhã'], ['amanha', 'amanhã'],
        ['PROXIMO', 'PRÓXIMO'], ['Proximo', 'Próximo'], ['proximo', 'próximo'],
        ['PROXIMOS', 'PRÓXIMOS'], ['Proximos', 'Próximos'], ['proximos', 'próximos'],
        ['LANCAMENTO', 'LANÇAMENTO'], ['Lancamento', 'Lançamento'], ['lancamento', 'lançamento'],
        ['LANCAMENTOS', 'LANÇAMENTOS'], ['Lancamentos', 'Lançamentos'], ['lancamentos', 'lançamentos'],
        ['DIARIAS', 'DIÁRIAS'], ['Diarias', 'Diárias'], ['diarias', 'diárias'],
        ['DIARIA', 'DIÁRIA'], ['Diaria', 'Diária'], ['diaria', 'diária'],
        ['HORARIA', 'HORÁRIA'], ['Horaria', 'Horária'], ['horaria', 'horária'],
        ['ULTIMO', 'ÚLTIMO'], ['Ultimo', 'Último'], ['ultimo', 'último'],
        ['CODIGO', 'CÓDIGO'], ['Codigo', 'Código'], ['codigo', 'código'],
        ['ESTA ATIVO', 'ESTÁ ATIVO'], ['Esta ativo', 'Está ativo'], ['esta ativo', 'está ativo'],
        ['ESTA PAUSADO', 'ESTÁ PAUSADO'], ['Esta pausado', 'Está pausado'], ['esta pausado', 'está pausado'],
        ['ENTRARA', 'ENTRARÁ'], ['Entrara', 'Entrará'], ['entrara', 'entrará'],
        ['INICIO', 'INÍCIO'], ['Inicio', 'Início'], ['inicio', 'início'],
        ['COPIA', 'CÓPIA'], ['Copia', 'Cópia'], ['copia', 'cópia'],
        ['ADMINISTRACAO PUBLICA', 'ADMINISTRAÇÃO PÚBLICA'],
        ['Administracao publica', 'Administração pública'],
        ['administracao publica', 'administração pública'],
        ['COMPREENSÃO E INTERPRETACAO', 'COMPREENSÃO E INTERPRETAÇÃO'],
        ['Compreensao e interpretacao', 'Compreensão e interpretação'],
        ['compreensao e interpretacao', 'compreensão e interpretação'],
        ['PROPOSICOES', 'PROPOSIÇÕES'], ['Proposicoes', 'Proposições'], ['proposicoes', 'proposições'],
        ['RACIOCINIO LOGICO', 'RACIOCÍNIO LÓGICO'],
        ['Raciocinio Logico', 'Raciocínio Lógico'],
        ['PORTUGUES', 'PORTUGUÊS'], ['Portugues', 'Português']
    ];
    ortografia.forEach(([de, para]) => {
        texto = texto.split(de).join(para);
    });
    perdidos.forEach(([de, para]) => {
        texto = texto.split(de).join(para);
    });
    return texto;
}

function pontuarMojibake(texto) {
    return ((String(texto).match(/[ÃÂ�]|â€|ðŸ|Å|Æ|¤|¢/g) || []).length);
}

function byteCp1252(ch) {
    const mapa = {
        '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
        'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
        '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
        '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F
    };
    const code = ch.charCodeAt(0);
    if(code <= 255) return code;
    return mapa[ch] ?? null;
}

function tentarDecodificarMojibake(texto) {
    if(!/[ÃÂ�]|â€|ðŸ|Å|Æ|¤|¢/.test(texto)) return texto;
    let atual = texto;
    for(let tentativa = 0; tentativa < 3; tentativa++) {
        const bytes = [];
        for(const ch of atual) {
            const byte = byteCp1252(ch);
            if(byte === null) {
                bytes.length = 0;
                break;
            }
            bytes.push(byte);
        }
        if(!bytes.length) break;
        const decodificado = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        if(!decodificado || decodificado === atual) break;
        if(pontuarMojibake(decodificado) > pontuarMojibake(atual)) break;
        atual = decodificado;
        if(!pontuarMojibake(atual)) break;
    }
    return atual;
}

function corrigirMojibakeValor(valor) {
    if(typeof valor !== 'string') return valor;
    let texto = tentarDecodificarMojibake(valor);
    const perdidos = [
        ['PLANT�O', 'PLANTÃO'], ['Plant�o', 'Plantão'], ['plant�o', 'plantão'],
        ['MISS�O', 'MISSÃO'], ['Miss�o', 'Missão'], ['miss�o', 'missão'],
        ['QUEST�ES', 'QUESTÕES'], ['Quest�es', 'Questões'], ['quest�es', 'questões'],
        ['REVIS�O', 'REVISÃO'], ['Revis�o', 'Revisão'], ['revis�o', 'revisão'],
        ['EXERC�CIOS', 'EXERCÍCIOS'], ['Exerc�cios', 'Exercícios'], ['exerc�cios', 'exercícios'],
        ['MAT�RIA', 'MATÉRIA'], ['Mat�ria', 'Matéria'], ['mat�ria', 'matéria'],
        ['MAT�RIAS', 'MATÉRIAS'], ['Mat�rias', 'Matérias'], ['mat�rias', 'matérias'],
        ['LAN�AMENTOS', 'LANÇAMENTOS'], ['Lan�amentos', 'Lançamentos'], ['lan�amentos', 'lançamentos'],
        ['DI�RIAS', 'DIÁRIAS'], ['Di�rias', 'Diárias'], ['di�rias', 'diárias'],
        ['HOR�RIOS', 'HORÁRIOS'], ['Hor�rios', 'Horários'], ['hor�rios', 'horários'],
        ['PRECIS�O', 'PRECISÃO'], ['Precis�o', 'Precisão'], ['precis�o', 'precisão'],
        ['PUBLICA��O', 'PUBLICAÇÃO'], ['Publica��o', 'Publicação'], ['publica��o', 'publicação'],
        ['APROVA��O', 'APROVAÇÃO'], ['Aprova��o', 'Aprovação'], ['aprova��o', 'aprovação'],
        ['SINCRONIZA��O', 'SINCRONIZAÇÃO'], ['Sincroniza��o', 'Sincronização'], ['sincroniza��o', 'sincronização']
    ];
    perdidos.forEach(([de, para]) => {
        texto = texto.split(de).join(para);
    });
    const trocas = [
        ['ÃƒÆ’', 'Ãƒ'],
        ['ÃƒÂ¡', 'á'], ['ÃƒÃ ', 'à'], ['ÃƒÂ¢', 'â'], ['ÃƒÂ£', 'ã'], ['ÃƒÂ©', 'é'], ['ÃƒÂª', 'ê'],
        ['ÃƒÂ­', 'í'], ['ÃƒÂ³', 'ó'], ['ÃƒÂ´', 'ô'], ['ÃƒÂµ', 'õ'], ['ÃƒÂº', 'ú'], ['ÃƒÂ§', 'ç'],
        ['ÃƒÃ', 'Á'], ['ÃƒÃ‰', 'É'], ['ÃƒÃ', 'Í'], ['ÃƒÃ“', 'Ó'], ['ÃƒÃš', 'Ú'], ['Ãƒâ€¡', 'Ç'],
        ['Ãƒâ€œ', 'Ó'], ['Ãƒâ€°', 'É'], ['ÃƒÅ ', 'Ê'], ['ÃƒÅ¡', 'Ú'],
        ['Ã¡', 'á'], ['Ã ', 'à'], ['Ã¢', 'â'], ['Ã£', 'ã'], ['Ã©', 'é'], ['Ãª', 'ê'],
        ['Ã­', 'í'], ['Ã³', 'ó'], ['Ã´', 'ô'], ['Ãµ', 'õ'], ['Ãº', 'ú'], ['Ã§', 'ç'],
        ['Ã', 'Á'], ['Ã‰', 'É'], ['Ã', 'Í'], ['Ã“', 'Ó'], ['Ãš', 'Ú'], ['Ã‡', 'Ç'],
        ['Âº', 'º'], ['Âª', 'ª'], ['Â·', '·'], ['Â', ''],
        ['â€“', '-'], ['â€”', '-'], ['â€˜', "'"], ['â€™', "'"], ['â€œ', '"'], ['â€', '"'],
        ['ðŸš“', '']
    ];
    for(let i = 0; i < 3; i++) {
        texto = tentarDecodificarMojibake(texto);
        trocas.forEach(([de, para]) => {
            texto = texto.split(de).join(para);
        });
    }
    const ortografia = [
        ['PLANTAO', 'PLANTÃO'], ['Plantao', 'Plantão'], ['plantao', 'plantão'],
        ['MISSAO', 'MISSÃO'], ['Missao', 'Missão'], ['missao', 'missão'],
        ['FORCA', 'FORÇA'], ['Forca', 'Força'], ['forca', 'força'],
        ['AMANHA', 'AMANHÃ'], ['Amanha', 'Amanhã'], ['amanha', 'amanhã'],
        ['PROXIMO', 'PRÓXIMO'], ['Proximo', 'Próximo'], ['proximo', 'próximo'],
        ['PROXIMOS', 'PRÓXIMOS'], ['Proximos', 'Próximos'], ['proximos', 'próximos'],
        ['REVISAO', 'REVISÃO'], ['Revisao', 'Revisão'], ['revisao', 'revisão'],
        ['EXERCICIOS', 'EXERCÍCIOS'], ['Exercicios', 'Exercícios'], ['exercicios', 'exercícios'],
        ['QUESTOES', 'QUESTÕES'], ['Questoes', 'Questões'], ['questoes', 'questões'],
        ['LANCAMENTO', 'LANÇAMENTO'], ['Lancamento', 'Lançamento'], ['lancamento', 'lançamento'],
        ['LANCAMENTOS', 'LANÇAMENTOS'], ['Lancamentos', 'Lançamentos'], ['lancamentos', 'lançamentos'],
        ['DISTRIBUICAO', 'DISTRIBUIÇÃO'], ['Distribuicao', 'Distribuição'], ['distribuicao', 'distribuição'],
        ['MATERIA', 'MATÉRIA'], ['Materia', 'Matéria'], ['materia', 'matéria'],
        ['MATERIAS', 'MATÉRIAS'], ['Materias', 'Matérias'], ['materias', 'matérias'],
        ['PRECISAO', 'PRECISÃO'], ['Precisao', 'Precisão'], ['precisao', 'precisão'],
        ['SEQUENCIA', 'SEQUÊNCIA'], ['Sequencia', 'Sequência'], ['sequencia', 'sequência'],
        ['DIARIAS', 'DIÁRIAS'], ['Diarias', 'Diárias'], ['diarias', 'diárias'],
        ['DIARIA', 'DIÁRIA'], ['Diaria', 'Diária'], ['diaria', 'diária'],
        ['HORARIA', 'HORÁRIA'], ['Horaria', 'Horária'], ['horaria', 'horária'],
        ['HORARIOS', 'HORÁRIOS'], ['Horarios', 'Horários'], ['horarios', 'horários'],
        ['ULTIMO', 'ÚLTIMO'], ['Ultimo', 'Último'], ['ultimo', 'último'],
        ['CODIGO', 'CÓDIGO'], ['Codigo', 'Código'], ['codigo', 'código'],
        ['ESTA ATIVO', 'ESTÁ ATIVO'], ['Esta ativo', 'Está ativo'], ['esta ativo', 'está ativo'],
        ['ESTA PAUSADO', 'ESTÁ PAUSADO'], ['Esta pausado', 'Está pausado'], ['esta pausado', 'está pausado'],
        ['ENTRARA', 'ENTRARÁ'], ['Entrara', 'Entrará'], ['entrara', 'entrará'],
        ['INICIO', 'INÍCIO'], ['Inicio', 'Início'], ['inicio', 'início'],
        ['COPIA', 'CÓPIA'], ['Copia', 'Cópia'], ['copia', 'cópia'],
        ['NAO', 'NÃO'], ['Nao', 'Não'], ['nao', 'não'],
        ['VOCE', 'VOCÊ'], ['Voce', 'Você'], ['voce', 'você'],
        ['PUBLICACAO', 'PUBLICAÇÃO'], ['Publicacao', 'Publicação'], ['publicacao', 'publicação'],
        ['APROVACAO', 'APROVAÇÃO'], ['Aprovacao', 'Aprovação'], ['aprovacao', 'aprovação'],
        ['SINCRONIZACAO', 'SINCRONIZAÇÃO'], ['Sincronizacao', 'Sincronização'], ['sincronizacao', 'sincronização'],
        ['ADMINISTRACAO PUBLICA', 'ADMINISTRAÇÃO PÚBLICA'],
        ['Administracao publica', 'Administração pública'],
        ['administracao publica', 'administração pública'],
        ['COMPREENSÃO E INTERPRETACAO', 'COMPREENSÃO E INTERPRETAÇÃO'],
        ['Compreensao e interpretacao', 'Compreensão e interpretação'],
        ['compreensao e interpretacao', 'compreensão e interpretação'],
        ['PROPOSICOES', 'PROPOSIÇÕES'], ['Proposicoes', 'Proposições'], ['proposicoes', 'proposições'],
        ['RACIOCINIO LOGICO', 'RACIOCÍNIO LÓGICO'],
        ['Raciocinio Logico', 'Raciocínio Lógico'],
        ['PORTUGUES', 'PORTUGUÊS'], ['Portugues', 'Português']
    ];
    ortografia.forEach(([de, para]) => {
        texto = texto.split(de).join(para);
    });
    perdidos.forEach(([de, para]) => {
        texto = texto.split(de).join(para);
    });
    return texto;
}

function corrigirTextosDaTela(root = document.body) {
    if(!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
        const corrigido = corrigirMojibakeValor(node.nodeValue);
        if(corrigido !== node.nodeValue) node.nodeValue = corrigido;
    });
    root.querySelectorAll?.('[placeholder], [title], [aria-label], input[value]').forEach(el => {
        ['placeholder', 'title', 'aria-label'].forEach(attr => {
            if(el.hasAttribute(attr)) {
                const atual = el.getAttribute(attr);
                const corrigido = corrigirMojibakeValor(atual);
                if(corrigido !== atual) el.setAttribute(attr, corrigido);
            }
        });
        if(el.tagName === 'INPUT' && el.type !== 'date' && typeof el.value === 'string') {
            const atual = el.value;
            const corrigido = corrigirMojibakeValor(atual);
            if(corrigido !== atual) el.value = corrigido;
        }
    });
    document.title = corrigirMojibakeValor(document.title)
        .replace('v.128', 'v.132')
        .replace('v.129', 'v.132')
        .replace('v.130', 'v.132')
        .replace('v.131', 'v.132');
}

let correcaoTextosAgendada = false;
let corretorTextosAtivo = false;

function agendarCorrecaoTextos() {
    if(correcaoTextosAgendada) return;
    correcaoTextosAgendada = true;
    requestAnimationFrame(() => {
        correcaoTextosAgendada = false;
        corrigirTextosDaTela();
    });
}

function iniciarCorretorTextosContinuo() {
    if(corretorTextosAtivo || !document.body) return;
    corretorTextosAtivo = true;
    const observer = new MutationObserver(() => agendarCorrecaoTextos());
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title', 'aria-label', 'value']
    });
    [150, 500, 1200, 2500].forEach(ms => setTimeout(() => corrigirTextosDaTela(), ms));
}

function save() {
    localStorage.setItem('prf_v120', JSON.stringify(db));
    agendarSalvamentoNuvem();
}

function dateKey(date) {
    return date.toLocaleDateString();
}

function addDays(date, days) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + days);
    return d;
}

function keyToDate(key) {
    const parts = key.split('/').map(Number);
    const monthFirst = new Date(2026, 4, 3).toLocaleDateString().startsWith('5');
    return monthFirst ? new Date(parts[2], parts[0] - 1, parts[1]) : new Date(parts[2], parts[1] - 1, parts[0]);
}

function isDue(dueKey, curKey) {
    if(!dueKey) return false;
    return keyToDate(dueKey) <= keyToDate(curKey);
}

function diaPausado(key) {
    return (db.diasPausados || []).includes(key);
}

function limparPlanejamentoFuturo(baseKey) {
    const base = keyToDate(baseKey);
    Object.keys(db.metaFixa).forEach(k => {
        if(keyToDate(k) > base) delete db.metaFixa[k];
    });
}

function showToast(titulo, texto) {
    const area = document.getElementById('toast-area');
    if(!area) return alert(titulo);
    const card = document.createElement('div');
    card.className = 'toast-card';
    card.innerHTML = `<strong>${corrigirMojibakeValor(titulo)}</strong><small>${corrigirMojibakeValor(texto)}</small>`;
    area.appendChild(card);
    corrigirTextosDaTela(card);
    setTimeout(() => card.remove(), 3600);
}

function firebaseConfigurado() {
    return Boolean(window.firebase && window.PLANTAO_FIREBASE_CONFIG && window.PLANTAO_FIREBASE_CONFIG.apiKey);
}

function supabaseConfigurado() {
    return Boolean(window.supabase && window.PLANTAO_SUPABASE_CONFIG && window.PLANTAO_SUPABASE_CONFIG.url && window.PLANTAO_SUPABASE_CONFIG.anonKey);
}

function criarClienteSupabase(accessToken = null) {
    if(accessToken) supabaseAccessToken = accessToken;
    const options = {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'implicit'
        }
    };
    if(supabaseAccessToken) {
        options.global = {
            headers: {
                Authorization: `Bearer ${supabaseAccessToken}`
            }
        };
    }
    return window.supabase.createClient(
        window.PLANTAO_SUPABASE_CONFIG.url,
        window.PLANTAO_SUPABASE_CONFIG.anonKey,
        options
    );
}

function setCloudStatus(texto) {
    const el = document.getElementById('cloud-login-status');
    if(el) el.innerText = corrigirMojibakeValor(texto);
}

function atualizarBotaoNovaSenha() {
    const btn = document.getElementById('update-password-btn');
    if(btn) btn.style.display = modoRecuperacaoSenha ? 'inline-flex' : 'none';
}

function garantirRankingInterface() {
    if(!document.getElementById('ranking-nav')) {
        const perfilNav = document.querySelector(".nav-item[onclick*='perfil']");
        if(perfilNav) {
            perfilNav.insertAdjacentHTML('beforebegin', `
                <div id="ranking-nav" class="nav-item admin-only" style="display:none;" onclick="showTab('ranking', this)">
                    <i class="fas fa-ranking-star"></i><span>Ranking</span>
                </div>`);
        }
    }
    if(!document.getElementById('ranking')) {
        const perfilPage = document.getElementById('perfil');
        if(perfilPage) {
            perfilPage.insertAdjacentHTML('beforebegin', `
                <div id="ranking" class="page">
                    <div class="page-header">
                        <div>
                            <h2>Ranking dos Alunos</h2>
                            <p class="meta-sub">Comparativo de horas estudadas, precisão e sequência de dias.</p>
                        </div>
                        <button class="btn btn-sm btn-outline" onclick="renderRankingAlunos()">
                            <i class="fas fa-rotate"></i> ATUALIZAR
                        </button>
                    </div>
                    <div id="ranking-content"></div>
                </div>`);
        }
    }
    if(!document.getElementById('ranking-inline-style')) {
        const style = document.createElement('style');
        style.id = 'ranking-inline-style';
        style.textContent = `
            .ranking-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:start}
            .ranking-card{display:grid;gap:10px}
            .ranking-card-head .meta-sub{margin-bottom:0}
            .ranking-row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:13px 0;border-top:1px solid var(--border)}
            .ranking-row:first-of-type{border-top:0}
            .ranking-pos{width:30px;height:30px;border-radius:999px;display:grid;place-items:center;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.28);color:#bae6fd;font-weight:900}
            .ranking-row b{color:#f8fafc;display:block}
            .ranking-row small{display:block;color:var(--text-sec);margin-top:4px;font-weight:700;overflow-wrap:anywhere}
            .ranking-row strong{color:var(--accent);white-space:nowrap;font-weight:900}
            @media (max-width:820px){.ranking-grid{grid-template-columns:1fr}.ranking-row{grid-template-columns:auto 1fr}.ranking-row strong{grid-column:2}}
        `;
        document.head.appendChild(style);
    }
}

function mostrarTelaLogin() {
    const tela = document.getElementById('login-screen');
    if(tela) tela.style.display = 'flex';
    const pass = document.getElementById('pass-input');
    if(pass) pass.value = '';
}

function ocultarTelaLogin() {
    const tela = document.getElementById('login-screen');
    if(tela) tela.style.display = 'none';
}

function nomeUsuario() {
    if(db?.perfilNome) return String(db.perfilNome).trim() || 'Matheus';
    if(!cloudUser) return 'Matheus';
    const meta = cloudUser.user_metadata || {};
    const nome = cloudUser.displayName || meta.full_name || meta.name || cloudUser.email || 'Matheus';
    return String(nome).split('@')[0].trim() || 'Matheus';
}

function emailUsuario() {
    return cloudUser?.email || 'Acesso local';
}

function loginUsuario() {
    if(!cloudUser) return 'local';
    if(accessProfile?.role === 'admin') return 'admin';
    if(accessProfile?.role === 'aluno') return 'aluno';
    return cloudUser.provider || cloudUser.appName || 'google';
}

function avatarUsuario() {
    const meta = cloudUser?.user_metadata || {};
    return cloudUser?.photoURL || meta.avatar_url || '';
}

function emailNormalizado() {
    return String(emailUsuario()).trim().toLowerCase();
}

function usuarioAdmin() {
    return emailNormalizado() === ADMIN_EMAIL;
}

function acessoAprovado() {
    return accessProfile?.status === 'approved' || usuarioAdmin();
}

function editandoAlunoComoAdmin() {
    return usuarioAdmin() && Boolean(adminStudentContext);
}

function alvoDadosNuvem() {
    if(editandoAlunoComoAdmin()) {
        return {
            user_id: adminStudentContext.user_id,
            email: adminStudentContext.email,
            name: adminStudentContext.name || adminStudentContext.email || 'Aluno'
        };
    }
    return {
        user_id: cloudUser?.id,
        email: cloudUser?.email || null,
        name: nomeUsuario()
    };
}

function preferenciasKey() {
    const alvo = alvoDadosNuvem();
    const id = alvo.user_id || cloudUser?.id || emailNormalizado() || 'local';
    return `plantao_prefs_${id}`;
}

function salvarPreferenciasLocais() {
    try {
        const prefs = {
            perfilNome: db.perfilNome || '',
            editalPublicacao: db.editalPublicacao || '',
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(preferenciasKey(), JSON.stringify(prefs));
    } catch(e) {}
}

function aplicarPreferenciasLocais() {
    try {
        const raw = localStorage.getItem(preferenciasKey());
        if(!raw) return;
        const prefs = JSON.parse(raw);
        if(prefs?.perfilNome && !db.perfilNome) db.perfilNome = prefs.perfilNome;
        if(prefs?.editalPublicacao && !db.editalPublicacao) db.editalPublicacao = prefs.editalPublicacao;
    } catch(e) {}
}

function cloneDados(valor) {
    return JSON.parse(JSON.stringify(valor || {}));
}

function erroColunaInexistente(error, coluna) {
    const texto = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return texto.includes(coluna.toLowerCase()) || texto.includes('column') || texto.includes('schema cache');
}

function mensagemErroSupabase(error) {
    const partes = [
        error?.message,
        error?.details,
        error?.hint,
        error?.code ? `Código: ${error.code}` : ''
    ].filter(Boolean);
    return partes.join(' | ') || 'Erro desconhecido do Supabase.';
}

function comTimeout(promise, ms, mensagem) {
    let timer;
    const limite = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(mensagem)), ms);
    });
    return Promise.race([promise, limite]).finally(() => clearTimeout(timer));
}

async function esperarSessaoSupabase(tentativas = 8, intervaloMs = 450) {
    for(let i = 0; i < tentativas; i++) {
        try {
            const { data, error } = await comTimeout(
                supabaseClient.auth.getSession(),
                2500,
                'Tempo esgotado ao verificar a sessão Supabase.'
            );
            if(error) throw error;
            if(data?.session?.user) return data.session;
        } catch(e) {
            if(i === tentativas - 1) return null;
        }
        await new Promise(resolve => setTimeout(resolve, intervaloMs));
    }
    return null;
}

async function trocarCodigoLoginSupabase(authCode) {
    const troca = supabaseClient.auth.exchangeCodeForSession(authCode);
    const limite = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tempo esgotado ao finalizar o login Google.')), 8000);
    });
    const { error } = await Promise.race([troca, limite]);
    if(error) throw error;
}

function decodificarJwtPayload(token) {
    try {
        const base64 = token.split('.')[1];
        if(!base64) return null;
        const normalizado = base64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalizado.padEnd(Math.ceil(normalizado.length / 4) * 4, '=');
        const json = decodeURIComponent(Array.from(atob(padded))
            .map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
            .join(''));
        return JSON.parse(json);
    } catch(e) {
        return null;
    }
}

function usuarioSupabasePorToken(accessToken) {
    const payload = decodificarJwtPayload(accessToken);
    if(!payload?.sub || !payload?.email) return null;
    const meta = payload.user_metadata || {};
    return {
        id: payload.sub,
        email: payload.email,
        provider: 'supabase',
        user_metadata: {
            full_name: meta.full_name || meta.name || payload.name || payload.email,
            name: meta.name || meta.full_name || payload.name || payload.email,
            avatar_url: meta.avatar_url || meta.picture || payload.picture || ''
        }
    };
}

async function sessaoSupabasePeloHash(hashParams) {
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if(!accessToken) return null;

    supabaseClient = criarClienteSupabase(accessToken);
    setCloudStatus('Login Google recebido. Preparando sua sessão...');
    if(refreshToken) {
        try {
            const { data, error } = await comTimeout(
                supabaseClient.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                }),
                6000,
                'Tempo esgotado ao salvar a sessão Supabase.'
            );
            if(error) throw error;
            supabaseAccessToken = data?.session?.access_token || accessToken;
            supabaseClient = criarClienteSupabase(supabaseAccessToken);
            if(data?.session?.user) return data.session;
        } catch(e) {
            setCloudStatus('Sessão Supabase demorou; liberando pelo token Google validado...');
            supabaseClient = criarClienteSupabase(accessToken);
        }
    }

    const user = usuarioSupabasePorToken(accessToken);
    return user ? { user, fallbackToken: true } : null;
}

function escapeHtml(valor) {
    return String(corrigirMojibakeValor(valor ?? '')).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[c]));
}

function parseDataISO(valor) {
    if(!valor) return null;
    const partes = String(valor).split('-').map(Number);
    if(partes.length !== 3 || partes.some(Number.isNaN)) return null;
    const data = new Date(partes[0], partes[1] - 1, partes[2]);
    data.setHours(0, 0, 0, 0);
    return data;
}

function formatarDataBR(valor) {
    const data = parseDataISO(valor);
    if(!data) return 'Não definida';
    return data.toLocaleDateString('pt-BR');
}

function diasAteData(valor) {
    const alvo = parseDataISO(valor);
    if(!alvo) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.ceil((alvo - hoje) / 86400000);
}

function textoDataEdital() {
    const dias = diasAteData(db.editalPublicacao);
    if(dias === null) return '';
    const data = formatarDataBR(db.editalPublicacao);
    if(dias > 1) return `Edital em ${dias} dias (${data})`;
    if(dias === 1) return `Edital amanhã (${data})`;
    if(dias === 0) return `Edital hoje (${data})`;
    return `Edital publicado em ${data}`;
}

function atualizarPersonalizacao() {
    garantirRankingInterface();
    const welcome = document.getElementById('welcome-title');
    if(welcome) welcome.innerText = `FORÇA E HONRA, ${nomeUsuario().toUpperCase()}!`;
    document.querySelectorAll('[data-student-name]').forEach(el => {
        el.innerText = nomeUsuario();
    });
    atualizarVisibilidadeAdmin();
    corrigirTextosDaTela();
}

function atualizarVisibilidadeAdmin() {
    const admin = usuarioAdmin();
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = admin ? (el.dataset.adminDisplay || 'flex') : 'none';
    });
    if(!admin) {
        adminAccessList = [];
        adminStudentContext = null;
        adminEditBackupReady = false;
    }
    renderAdminStudentBanner();
}

async function verificarAcessoSupabase() {
    if(!supabaseClient || !cloudUser) return { status: 'local', role: 'local' };
    const email = emailNormalizado();
    const name = nomeUsuario();
    const meta = cloudUser.user_metadata || {};
    const phone = meta.phone || meta.telefone || '';
    const contest = meta.contest || meta.concurso || '';
    const age = parseInt(meta.age || meta.idade || '0', 10) || null;
    const agora = new Date().toISOString();

    if(email === ADMIN_EMAIL) {
        const adminProfile = {
            user_id: cloudUser.id,
            email,
            name,
            role: 'admin',
            status: 'approved',
            requested_at: agora,
            approved_at: agora,
            approved_by: email
        };
        supabaseClient.from(ACCESS_TABLE).upsert(adminProfile, { onConflict: 'email' }).then(({ error }) => {
            if(!error) return;
            const { user_id, ...adminSemUserId } = adminProfile;
            return supabaseClient.from(ACCESS_TABLE).upsert(adminSemUserId, { onConflict: 'email' });
        }).catch(() => {});
        return adminProfile;
    }

    const criarSolicitacaoPendente = async () => {
        const pending = {
            user_id: cloudUser.id,
            email,
            name,
            phone,
            contest,
            age,
            role: 'aluno',
            status: 'pending',
            requested_at: agora
        };
        const { error } = await supabaseClient.from(ACCESS_TABLE).insert(pending);
        if(error) {
            if(erroColunaInexistente(error, 'user_id')) {
                const { user_id, ...pendingSemUserId } = pending;
                const retry = await supabaseClient.from(ACCESS_TABLE).insert(pendingSemUserId);
                if(retry.error) throw retry.error;
                return pendingSemUserId;
            }
            if(erroColunaInexistente(error, 'phone') || erroColunaInexistente(error, 'contest') || erroColunaInexistente(error, 'age')) {
                const { phone, contest, age, ...pendingBasico } = pending;
                const retry = await supabaseClient.from(ACCESS_TABLE).insert(pendingBasico);
                if(retry.error) throw retry.error;
                return pendingBasico;
            }
            throw error;
        }
        return pending;
    };

    const atualizarRegistroExistente = async (data) => {
        if(data.name === name && data.user_id === cloudUser.id) return data;
        try {
            const updatePayload = { name, user_id: cloudUser.id };
            if(phone && !data.phone) updatePayload.phone = phone;
            if(contest && !data.contest) updatePayload.contest = contest;
            if(age && !data.age) updatePayload.age = age;
            const { error } = await supabaseClient.from(ACCESS_TABLE).update(updatePayload).eq('email', email);
            if(error) throw error;
        } catch(e) {}
        return { ...data, name, user_id: cloudUser.id, phone: data.phone || phone, contest: data.contest || contest, age: data.age || age };
    }

    const { data, error } = await comTimeout(
        supabaseClient
            .from(ACCESS_TABLE)
            .select('*')
            .eq('email', email)
            .maybeSingle(),
        8000,
        'Tempo esgotado ao verificar aprovação.'
    );
    if(error) throw error;

    if(data) {
        return atualizarRegistroExistente(data);
    }

    return criarSolicitacaoPendente();
}

function bloquearAcessoPorAprovacao(profile) {
    accessProfile = profile;
    const status = profile?.status || 'pending';
    const texto = status === 'rejected'
        ? 'Seu acesso foi recusado pelo administrador.'
        : 'Seu acesso foi solicitado. Aguarde aprovação do administrador.';
    setCloudStatus(texto);
    atualizarPersonalizacao();
    mostrarTelaLogin();
}

async function entrarComSessaoSupabase(user) {
    cloudUser = {...user, provider: 'supabase'};
    setCloudStatus(`Conectado como ${cloudUser.email || 'Google'}. Verificando aprovação...`);
    try {
        accessProfile = await verificarAcessoSupabase();
    } catch(e) {
        accessProfile = null;
        setCloudStatus(`Não foi possível solicitar/verificar aprovação: ${mensagemErroSupabase(e)}`);
        mostrarTelaLogin();
        return;
    }
    if(!acessoAprovado()) {
        bloquearAcessoPorAprovacao(accessProfile);
        return;
    }
    setCloudStatus(`Acesso liberado como ${loginUsuario()}.`);
    await carregarDadosDaNuvem();
    ocultarTelaLogin();
    atualizarPersonalizacao();
    init();
}

async function initSupabaseAuth() {
    if(!supabaseConfigurado()) return false;
    try {
        supabaseClient = criarClienteSupabase();
        setCloudStatus('Supabase conectado. Verificando login...');
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const authCode = url.searchParams.get('code');
        const authType = hashParams.get('type') || url.searchParams.get('type');
        const authError = url.searchParams.get('error_description')
            || hashParams.get('error_description')
            || url.searchParams.get('error')
            || hashParams.get('error');

        if(authError) {
            setCloudStatus(`Login Google não concluído: ${decodeURIComponent(authError)}`);
            window.history.replaceState({}, document.title, window.location.pathname);
            return true;
        }

        if(authCode) {
            authProcessandoRetorno = true;
            setCloudStatus('Login retornou em modo código. Limpando retorno antigo; clique em Entrar com Google novamente.');
            window.history.replaceState({}, document.title, window.location.pathname);
            authProcessandoRetorno = false;
            return true;
        }

        const session = hashParams.get('access_token')
            ? await sessaoSupabasePeloHash(hashParams)
            : await esperarSessaoSupabase(window.location.hash ? 10 : 1);
        authProcessandoRetorno = false;
        if(window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        if(session?.user) {
            supabaseAccessToken = session.access_token || supabaseAccessToken;
            if(supabaseAccessToken) supabaseClient = criarClienteSupabase(supabaseAccessToken);
            if(authType === 'recovery') {
                modoRecuperacaoSenha = true;
                cloudUser = {...session.user, provider: 'supabase'};
                mostrarTelaLogin();
                atualizarBotaoNovaSenha();
                setCloudStatus('Digite sua nova senha no campo Senha e clique em Salvar nova senha.');
                return true;
            }
            await entrarComSessaoSupabase(session.user);
        } else {
            setCloudStatus('Entre com Google para sincronizar na nuvem.');
        }
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if(session?.user) {
                supabaseAccessToken = session.access_token || supabaseAccessToken;
                if(supabaseAccessToken) supabaseClient = criarClienteSupabase(supabaseAccessToken);
                await entrarComSessaoSupabase(session.user);
            } else {
                if(authProcessandoRetorno || event === 'INITIAL_SESSION') return;
                cloudUser = null;
                accessProfile = null;
                setCloudStatus('Entre com Google para sincronizar na nuvem.');
                atualizarPersonalizacao();
                mostrarTelaLogin();
            }
        });
        return true;
    } catch(e) {
        setCloudStatus(`Não foi possível concluir o login Supabase: ${mensagemErroSupabase(e)}`);
        return false;
    }
}

function initFirebaseAuth() {
    firebaseApp = null;
    firebaseAuth = null;
    firebaseStore = null;
    setCloudStatus('Firebase desativado. Este projeto usa Supabase com aprovação do admin.');
    return false;
}

async function loginGoogle() {
    if(supabaseConfigurado()) {
        try {
            if(!supabaseClient) await initSupabaseAuth();
            const cleanRedirect = `${window.location.origin}${window.location.pathname}`;
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: cleanRedirect,
                    queryParams: { prompt: 'select_account' }
                }
            });
            if(error) setCloudStatus('Não foi possível iniciar login Google no Supabase.');
            return;
        } catch(e) {
            setCloudStatus('Login Google cancelado ou bloqueado pelo navegador.');
            return;
        }
    }
    setCloudStatus('Supabase não configurado. Configure o supabase-config.js para usar login aprovado.');
}

function mostrarCadastroAluno(mostrar) {
    const box = document.getElementById('cadastro-aluno-box');
    if(box) box.style.display = mostrar ? 'grid' : 'none';
    setCloudStatus(mostrar ? 'Preencha o cadastro. O acesso só entra após aprovação do admin.' : 'Entre com Google ou e-mail para continuar.');
}

function dadosCadastroAluno() {
    const nome = document.getElementById('cadastro-nome')?.value.trim() || '';
    const telefone = document.getElementById('cadastro-telefone')?.value.trim() || '';
    const concurso = document.getElementById('cadastro-concurso')?.value.trim() || '';
    const idade = parseInt(document.getElementById('cadastro-idade')?.value || '0', 10);
    const email = String(document.getElementById('cadastro-email')?.value || '').trim().toLowerCase();
    const senha = document.getElementById('cadastro-senha')?.value || '';
    return { nome, telefone, concurso, idade, email, senha };
}

function limparCadastroAluno() {
    ['cadastro-nome', 'cadastro-telefone', 'cadastro-concurso', 'cadastro-idade', 'cadastro-email', 'cadastro-senha'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
}

async function registrarSolicitacaoCadastro({ userId, email, nome, telefone, concurso, idade }) {
    const payload = {
        user_id: userId || null,
        email,
        name: nome,
        phone: telefone,
        contest: concurso,
        age: idade || null,
        role: 'aluno',
        status: 'pending',
        requested_at: new Date().toISOString()
    };
    const enviar = async dados => {
        const { error } = await supabaseClient.from(ACCESS_TABLE).upsert(dados, { onConflict: 'email' });
        if(error) throw error;
    };
    try {
        await enviar(payload);
    } catch(e) {
        if(erroColunaInexistente(e, 'phone') || erroColunaInexistente(e, 'contest') || erroColunaInexistente(e, 'age')) {
            const { phone, contest, age, ...fallback } = payload;
            await enviar(fallback);
            return;
        }
        throw e;
    }
}

async function cadastrarAluno() {
    if(!supabaseConfigurado()) {
        setCloudStatus('Supabase não configurado. Configure o supabase-config.js antes de cadastrar alunos.');
        return;
    }
    const dados = dadosCadastroAluno();
    if(dados.nome.length < 5 || !dados.telefone || !dados.concurso || !dados.idade || !dados.email || dados.senha.length < 6) {
        setCloudStatus('Preencha nome completo, telefone, concurso, idade, e-mail e senha com pelo menos 6 caracteres.');
        return;
    }
    try {
        if(!supabaseClient) supabaseClient = criarClienteSupabase();
        setCloudStatus('Criando cadastro e enviando para aprovação...');
        const { data, error } = await supabaseClient.auth.signUp({
            email: dados.email,
            password: dados.senha,
            options: {
                data: {
                    full_name: dados.nome,
                    phone: dados.telefone,
                    contest: dados.concurso,
                    age: dados.idade
                }
            }
        });
        if(error) throw error;
        await registrarSolicitacaoCadastro({
            userId: data?.user?.id,
            email: dados.email,
            nome: dados.nome,
            telefone: dados.telefone,
            concurso: dados.concurso,
            idade: dados.idade
        });
        limparCadastroAluno();
        mostrarCadastroAluno(false);
        try { await supabaseClient.auth.signOut({ scope: 'local' }); } catch(e) {}
        setCloudStatus('Cadastro enviado. Aguarde aprovação do administrador para entrar.');
    } catch(e) {
        setCloudStatus(`Não foi possível cadastrar: ${mensagemErroSupabase(e)}`);
    }
}

async function entrarEmailSenha() {
    if(!supabaseConfigurado()) {
        setCloudStatus('Supabase não configurado. Configure o supabase-config.js para entrar.');
        return;
    }
    const email = String(document.getElementById('login-email')?.value || '').trim().toLowerCase();
    const senha = document.getElementById('login-senha')?.value || '';
    if(!email || !senha) {
        setCloudStatus('Informe e-mail e senha.');
        return;
    }
    try {
        if(!supabaseClient) supabaseClient = criarClienteSupabase();
        setCloudStatus('Entrando com e-mail e senha...');
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
        if(error) throw error;
        supabaseAccessToken = data?.session?.access_token || supabaseAccessToken;
        if(supabaseAccessToken) supabaseClient = criarClienteSupabase(supabaseAccessToken);
        if(data?.user) await entrarComSessaoSupabase(data.user);
    } catch(e) {
        const msg = mensagemErroSupabase(e);
        if(email === ADMIN_EMAIL) {
            setCloudStatus(`Não foi possível entrar como admin: ${msg}. Se a senha ainda não foi criada, clique em Criar ou recuperar senha.`);
            return;
        }
        setCloudStatus(`Não foi possível entrar: ${msg}`);
    }
}

async function enviarRecuperacaoSenha() {
    if(!supabaseConfigurado()) {
        setCloudStatus('Supabase não configurado. Configure o supabase-config.js para recuperar senha.');
        return;
    }
    const email = String(document.getElementById('login-email')?.value || '').trim().toLowerCase();
    if(!email) {
        setCloudStatus('Digite seu e-mail no campo E-mail antes de recuperar a senha.');
        return;
    }
    try {
        if(!supabaseClient) supabaseClient = criarClienteSupabase();
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
        if(error) throw error;
        setCloudStatus('Enviamos um link para seu e-mail. Abra o link, digite a nova senha aqui e clique em Salvar nova senha.');
    } catch(e) {
        setCloudStatus(`Não foi possível enviar recuperação de senha: ${mensagemErroSupabase(e)}`);
    }
}

async function salvarNovaSenhaEmail() {
    if(!supabaseConfigurado()) {
        setCloudStatus('Supabase não configurado. Configure o supabase-config.js para salvar senha.');
        return;
    }
    if(!supabaseClient) supabaseClient = criarClienteSupabase();
    const senha = document.getElementById('login-senha')?.value || '';
    if(!senha || senha.length < 6) {
        setCloudStatus('Digite uma nova senha com pelo menos 6 caracteres.');
        return;
    }
    try {
        setCloudStatus('Salvando nova senha...');
        const { data, error } = await supabaseClient.auth.updateUser({ password: senha });
        if(error) throw error;
        modoRecuperacaoSenha = false;
        atualizarBotaoNovaSenha();
        setCloudStatus('Senha salva. Entrando na plataforma...');
        if(data?.user) await entrarComSessaoSupabase(data.user);
    } catch(e) {
        setCloudStatus(`Não foi possível salvar a nova senha: ${mensagemErroSupabase(e)}`);
    }
}
async function sairGoogle() {
    try {
        clearTimeout(cloudSaveTimer);
        if(supabaseClient) {
            try {
                await comTimeout(supabaseClient.auth.signOut({ scope: 'local' }), 3500, 'Tempo esgotado ao sair.');
            } catch(e) {}
        }
        if(firebaseAuth) {
            try { await firebaseAuth.signOut(); } catch(e) {}
        }
        Object.keys(localStorage).forEach(key => {
            if(key.startsWith('sb-') || key.includes('supabase.auth.token')) localStorage.removeItem(key);
        });
        Object.keys(sessionStorage).forEach(key => {
            if(key.startsWith('sb-') || key.includes('supabase.auth.token')) sessionStorage.removeItem(key);
        });
    } catch(e) {
        setCloudStatus('Sessão local encerrada. Entre novamente com Google.');
    } finally {
        cloudUser = null;
        supabaseAccessToken = null;
        accessProfile = null;
        adminAccessList = [];
        adminStudentContext = null;
        adminEditBackupReady = false;
        modoRecuperacaoSenha = false;
        atualizarBotaoNovaSenha();
        atualizarPersonalizacao();
        renderPerfil();
        mostrarTelaLogin();
        window.history.replaceState({}, document.title, window.location.pathname);
        setCloudStatus('Você saiu do login. Entre novamente com Google.');
    }
}

function refDadosUsuario() {
    if(!firebaseStore || !cloudUser) return null;
    return firebaseStore.collection('plantao-policial-users').doc(cloudUser.uid);
}

async function carregarDadosDaNuvem() {
    if(supabaseClient && cloudUser?.provider === 'supabase') return carregarDadosSupabase();
    const ref = refDadosUsuario();
    if(!ref) return;
    carregandoNuvem = true;
    try {
        const snap = await ref.get();
        if(snap.exists && snap.data()?.db) {
            db = snap.data().db;
            localStorage.setItem('prf_v120', JSON.stringify(db));
            normalizarBanco();
            showToast('Dados sincronizados', 'Seu planejamento foi carregado da nuvem.');
        } else {
            await salvarDadosNaNuvem(true);
            showToast('Nuvem ativada', 'Seus dados locais foram salvos na sua conta Google.');
        }
    } catch(e) {
        showToast('Sincronização indisponível', 'O site continuará usando a cópia local neste dispositivo.');
    } finally {
        carregandoNuvem = false;
    }
}

function agendarSalvamentoNuvem() {
    const nuvemDisponivel = (supabaseClient && cloudUser?.provider === 'supabase') || firebaseStore;
    if(carregandoNuvem || !cloudUser || !nuvemDisponivel) return;
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => salvarDadosNaNuvem(false), 1200);
}

async function salvarDadosNaNuvem(imediato) {
    if(supabaseClient && cloudUser?.provider === 'supabase') return salvarDadosSupabase(imediato);
    const ref = refDadosUsuario();
    if(!ref) return;
    if(!imediato) clearTimeout(cloudSaveTimer);
    try {
        await ref.set({
            db,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            email: cloudUser.email || null
        }, { merge: true });
    } catch(e) {
        showToast('Falha ao salvar na nuvem', 'A cópia local continua preservada no navegador.');
    }
}

async function carregarDadosSupabase() {
    if(!supabaseClient || !cloudUser) return false;
    const alvo = alvoDadosNuvem();
    if(!alvo.user_id) {
        showToast('Aluno sem dados ainda', 'Esse aluno precisa entrar uma vez pelo Google antes de você editar o perfil dele.');
        return false;
    }
    carregandoNuvem = true;
    try {
        const { data, error } = await supabaseClient
            .from('plantao_user_data')
            .select('data')
            .eq('user_id', alvo.user_id)
            .maybeSingle();
        if(error) throw error;
        if(data?.data) {
            db = data.data;
            localStorage.setItem('prf_v120', JSON.stringify(db));
            normalizarBanco();
            aplicarPreferenciasLocais();
            localStorage.setItem('prf_v120', JSON.stringify(db));
            showToast('Dados sincronizados', editandoAlunoComoAdmin() ? `Perfil de ${alvo.email} carregado.` : 'Seu planejamento foi carregado do Supabase.');
            return true;
        } else {
            if(editandoAlunoComoAdmin()) {
                showToast('Aluno sem planejamento', 'O aluno ainda não tem dados salvos no Supabase.');
                return false;
            }
            aplicarPreferenciasLocais();
            await salvarDadosSupabase(true);
            showToast('Nuvem ativada', 'Seus dados locais foram salvos no Supabase.');
            return true;
        }
    } catch(e) {
        showToast('Sincronização indisponível', 'Confira a tabela e as regras do Supabase.');
        return false;
    } finally {
        carregandoNuvem = false;
    }
}

async function garantirBackupEdicaoAdmin(alvo) {
    if(!editandoAlunoComoAdmin() || adminEditBackupReady || !supabaseClient || !alvo?.user_id) return;
    try {
        const { data, error } = await supabaseClient
            .from('plantao_user_data')
            .select('data')
            .eq('user_id', alvo.user_id)
            .maybeSingle();
        if(error) throw error;
        const { error: backupError } = await supabaseClient
            .from('plantao_admin_backups')
            .insert({
                admin_email: ADMIN_EMAIL,
                student_user_id: alvo.user_id,
                student_email: alvo.email || null,
                before_data: cloneDados(data?.data || db),
                note: 'Backup automático antes de edição pelo admin'
            });
        if(backupError) throw backupError;
        adminEditBackupReady = true;
        showToast('Backup do aluno criado', 'Uma cópia dos dados anteriores foi salva antes da sua edição.');
    } catch(e) {
        showToast('Backup não confirmado', 'Confira a tabela plantao_admin_backups antes de editar este aluno.');
        throw e;
    }
}

async function salvarDadosSupabase(imediato) {
    if(!supabaseClient || !cloudUser) return;
    const alvo = alvoDadosNuvem();
    if(!alvo.user_id) return;
    if(!imediato) clearTimeout(cloudSaveTimer);
    try {
        await garantirBackupEdicaoAdmin(alvo);
        const { error } = await supabaseClient
            .from('plantao_user_data')
            .upsert({
                user_id: alvo.user_id,
                data: db,
                email: alvo.email || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        if(error) throw error;
    } catch(e) {
        showToast('Falha ao salvar na nuvem', 'A cópia local continua preservada no navegador.');
    }
}

function normalizarTextosProfundo(valor) {
    if(typeof valor === 'string') return corrigirMojibakeValor(valor);
    if(Array.isArray(valor)) return valor.map(item => normalizarTextosProfundo(item));
    if(valor && typeof valor === 'object') {
        Object.keys(valor).forEach(chave => {
            valor[chave] = normalizarTextosProfundo(valor[chave]);
        });
    }
    return valor;
}

function normalizarBanco() {
    normalizarTextosProfundo(db);
    if(db.schemaVersion !== 23) {
        db.metaFixa = {};
        db.schemaVersion = 23;
    }
    if(!db.metaFixa) db.metaFixa = {};
    if(!db.h) db.h = {};
    if(!Array.isArray(db.lista)) db.lista = [];
    if(!Array.isArray(db.ciclo)) db.ciclo = [];
    if(!Array.isArray(db.diasPausados)) db.diasPausados = [];
    db.perfilNome = String(db.perfilNome || '').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(db.editalPublicacao || '')) db.editalPublicacao = '';
    for(let i=0; i<7; i++) db.h[i] = Math.max(0, parseFloat(db.h[i] || 0));
    db.lista.forEach((item, idx) => {
        item.m = corrigirMojibakeValor(String(item.m || '')).toUpperCase();
        item.a = corrigirMojibakeValor(String(item.a || ''));
        item.id = item.id || `${safeId(item.m)}-${safeId(item.a)}-${idx}-${Date.now()}`;
        item.ordem = Number.isFinite(item.ordem) ? item.ordem : idx;
        item.peso = limitarPeso(item.peso);
        item.h = item.h || {};
        item.h.E = Math.max(0.5, parseFloat(item.h.E || 1.5));
        item.h.Rev = 1;
        item.h.Ex = 1;
        item.done = item.done || {E:false, Rev:false, Ex:false};
        item.sinalizado = item.sinalizado === true;
        item.hF = Math.max(0, parseFloat(item.hF || 0));
        item.f = Boolean(item.f);
        if(item.sinalizado && !item.f) {
            item.f = true;
            item.revCycle = item.revCycle || { cycle: 1, stage: 'Rev', due: dateKey(addDays(new Date(), 1)) };
        }
        if(item.f) {
            item.done = {E:true, Rev:true, Ex:true};
            item.hF = item.h.E;
            if(item.revCycle && !item.revCycle.cycle) {
                item.revCycle = { cycle: (item.revCycle.intervalIndex || 0) + 1, stage: item.revCycle.stage || 'Rev', due: item.revCycle.due || dateKey(addDays(new Date(), 1)) };
            }
        }
        item.maintDone = Boolean(item.maintDone);
        item.extraTeoria = Math.max(0, parseFloat(item.extraTeoria || 0));
        if(!item.f) item.done.E = (item.hF || 0) >= item.h.E - 0.01;
        if(!item.sinalizado && !item.cicloConcluidoManual) {
            item.f = Boolean(item.f);
            item.done = {
                E: Boolean(item.done?.E),
                Rev: Boolean(item.done?.Rev),
                Ex: Boolean(item.done?.Ex)
            };
            item.hF = Math.min(item.hF, item.h.E);
            item.lastInitialStudyDate = item.lastInitialStudyDate || null;
            item.lastInitialRevDate = item.lastInitialRevDate || null;
            item.revCycle = item.revCycle || null;
            item.maintDone = Boolean(item.maintDone);
        }
    });
    Object.values(db.metaFixa || {}).forEach(tasks => {
        if(!Array.isArray(tasks)) return;
        tasks.forEach(task => {
            task.m = corrigirMojibakeValor(String(task.m || '')).toUpperCase();
            task.a = corrigirMojibakeValor(String(task.a || ''));
            task.l = corrigirMojibakeValor(String(task.l || ''));
        });
    });
    db.ciclo = db.ciclo.map(m => corrigirMojibakeValor(String(m || '')).toUpperCase()).filter(m => db.lista.some(x => x.m === m));
    db.diasPausados = [...new Set(db.diasPausados)].filter(Boolean);
    save();
}

normalizarBanco();

function checkAccess() {
    setCloudStatus('Acesso local desativado. Entre com Google e aguarde aprovação do admin.');
}

document.addEventListener('DOMContentLoaded', async () => {
    garantirRankingInterface();
    corrigirTextosDaTela();
    iniciarCorretorTextosContinuo();
    const supabaseOk = await initSupabaseAuth();
    if(!supabaseOk) {
        setCloudStatus('Supabase não configurado ou supabase-config.js não carregado. O acesso depende do login aprovado pelo admin.');
    }
    setTimeout(() => corrigirTextosDaTela(), 800);
});

function init() {
    atualizarPersonalizacao();
    renderAdminStudentBanner();
    renderDiario(vDate);
    updateDashboard();
    corrigirTextosDaTela();
}

function showTab(id, el) {
    const paginasAdmin = ['ranking'];
    if(id === 'backup') id = 'perfil';
    if(paginasAdmin.includes(id) && !usuarioAdmin()) {
        showToast('Acesso restrito', 'Esta área aparece somente para administradores.');
        id = 'diaria';
        el = document.querySelector(".nav-item[onclick*='diaria']");
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) el.classList.add('active');
    if(id === 'semanal') renderSemanal();
    if(id === 'ciclo') renderCiclo();
    if(id === 'config-h') renderHInputs();
    if(id === 'sinalizar') renderTree();
    if(id === 'fluxo') renderFluxo();
    if(id === 'replanejar') renderReplanejamento();
    if(id === 'lancamentos') renderLancamentos();
    if(id === 'performance') renderPerformance();
    if(id === 'ranking') renderRankingAlunos();
    if(id === 'perfil') renderPerfil();
    atualizarVisibilidadeAdmin();
    renderAdminStudentBanner();
    updateDashboard();
    corrigirTextosDaTela();
}

function toggleSub() {
    document.getElementById('sub-plano').classList.toggle('show');
}

function updateDashboard() {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const pD = new Date(hoje);
    pD.setDate(hoje.getDate() - hoje.getDay());
    const semana = calcularSemanaPlanejada();
    let horasPlanejadas=0, horasConcluidas=0, tQ=0, aQ=0;

    for(let i=0; i<7; i++) {
        const d = new Date(pD);
        d.setDate(pD.getDate() + i);
        const k = dateKey(d);
        const baseTasks = tarefasPlanejadas(semana[k] || []);
        const realTasks = tarefasPlanejadas(db.metaFixa[k] || []);
        const mapa = new Map();

        baseTasks.forEach(t => {
            mapa.set(`${t.itemId || t.m}-${t.k}-${t.a}`, {...t});
        });
        realTasks.forEach(t => {
            const chave = `${t.itemId || t.m}-${t.k}-${t.a}`;
            mapa.set(chave, {...(mapa.get(chave) || {}), ...t});
            if(t.c && t.perf){ tQ += t.perf.t || 0; aQ += t.perf.a || 0; }
        });

        Array.from(mapa.values()).forEach(t => {
            const horas = parseFloat(t.h) || 0;
            horasPlanejadas += horas;
            if(t.c) horasConcluidas += horas;
        });
    }

    const progressoSemana = horasPlanejadas ? Math.min(100, Math.round((horasConcluidas / horasPlanejadas) * 100)) : 0;
    document.getElementById('prog-dia').innerText = progressoSemana + "%";
    document.getElementById('bar-dia').style.width = progressoSemana + "%";
    document.getElementById('horas-hoje').innerText = horasConcluidas.toFixed(1) + "h";
    document.getElementById('precisao-dia').innerText = tQ ? Math.round((aQ/tQ)*100) + "%" : "0%";
    atualizarProgressoCiclo();
    checkStreak();
}

function renderDiario(date) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const viewDate = new Date(date); viewDate.setHours(0,0,0,0);
    const curStr = dateKey(date);
    let temAtr = false;
    const pD = new Date(hoje); pD.setDate(hoje.getDate() - hoje.getDay());

    for(let i=0; i<hoje.getDay(); i++) {
        const dP = new Date(pD); dP.setDate(pD.getDate() + i);
        if(db.metaFixa[dateKey(dP)]?.some(t => !t.c)) { temAtr = true; break; }
    }

    const btnReplan = document.querySelector('.replan-btn');
    if(btnReplan) btnReplan.style.display = temAtr ? "inline-flex" : "none";

    if(viewDate > hoje && temAtr) {
        document.getElementById('lista-diaria').innerHTML = `
            <div class="stat-card" style="text-align:center; border:2px solid red;">
                <h3 style="color:red;">ACESSO BLOQUEADO</h3>
                <p>Conclua os plantoes atrasados desta semana antes de avancar.</p>
            </div>`;
        return;
    }

    garantirDiaPlanejado(curStr, date);

    const tasks = db.metaFixa[curStr];
    document.getElementById('meta-status').innerText = `${tasks.reduce((a,b)=>a+b.h,0).toFixed(1)}h / ${db.h[date.getDay()]}h meta`;
    const atrasos = curStr === dateKey(hoje) ? getAtrasosDaSemana(hoje) : [];
    const atrasoHtml = atrasos.length ? `
        <div class="stat-card atraso-box">
            <h3>Atividades em atraso</h3>
            <p>Você tem atividade(s) anterior(es) não finalizada(s). Deseja replanejar os atrasos?</p>
            <button class="btn btn-sm btn-outline" onclick="replanejarAgora()">REPLANEJAR ATRASOS</button>
        </div>
        ${atrasos.map(({task, dia}) => renderTaskCard(task, dia, `atraso-${dia}-${task.itemId || task.m}`, true)).join('')}
    ` : '';

    const planejadasDoDia = tarefasPlanejadas(tasks);
    const diaConcluido = planejadasDoDia.length > 0 && planejadasDoDia.every(t => t.c);
    const conclusaoHtml = diaConcluido ? renderMissaoCumpridaCard(curStr === dateKey(hoje)) : '';
    const pausaHtml = diaPausado(curStr) ? `
        <div class="empty-state replan-empty">
            <i class="fas fa-calendar-minus"></i>
            <strong>Dia pausado</strong>
            <span>Hoje ficou vazio e o planejamento recomeça amanhã.</span>
            <button class="btn btn-sm btn-outline" onclick="showTab('replanejar')">VER REPLANEJAMENTO</button>
        </div>` : '';

    document.getElementById('lista-diaria').innerHTML = atrasoHtml + pausaHtml + tasks.map((t, i) => renderTaskCard(t, curStr, i, false)).join('') + conclusaoHtml;

    document.getElementById('lista-diaria').innerHTML += `
        <button class="btn-extra-diario" onclick="abrirModalExtra()">
            <i class="fas fa-plus-circle"></i> ESTUDOU ALGO FORA DO PLANEJADO?
        </button>`;

    const ehHoje = curStr === dateKey(hoje);
    document.getElementById('view-title').innerText = ehHoje ? "Missão de Hoje" : "Missão de Amanhã";
    document.getElementById('btn-hoje').style.display = ehHoje ? "none" : "inline-flex";
}

function renderMissaoCumpridaCard(ehHoje) {
    return `
        <div class="mission-complete-card">
            <div class="mission-complete-icon"><i class="fas fa-check"></i></div>
            <div>
                <h3>Missão cumprida</h3>
                <p>Parabéns, você concluiu todas as atividades planejadas para este dia.</p>
            </div>
            <button class="btn btn-sm" onclick="navDay(1)">
                <i class="fas fa-arrow-right"></i> ${ehHoje ? 'ADIANTAR AMANHÃ' : 'VER PRÓXIMO DIA'}
            </button>
        </div>`;
}

function renderTaskCard(t, dia, idx, atrasada) {
    const checkAction = atrasada ? `cliqueTask('${dia}', ${db.metaFixa[dia].indexOf(t)})` : `cliqueTask('${dia}', ${idx})`;
    const timerId = safeId(String(idx));
    return `
        <div class="task-card ${t.c ? 'done' : ''}" style="border-left-color:var(--color-${t.k==='Ex'?'ex':(t.k==='Rev'?'rev':'e')})">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; gap:12px;">
                    <span class="tag tag-${t.k==='Ex'?'ex':(t.k==='Rev'?'rev':'e')}">${t.l}</span>
                    <small style="font-weight:700;">${atrasada ? 'ATRASO - ' : ''}${dia} | ${(parseFloat(t.h) || 0).toFixed(1)}h</small>
                </div>
                <div style="font-weight:800; font-size:1.1rem;">${t.m}</div>
                <div style="font-size:0.85rem; color:var(--text-sec); margin-bottom:10px;">${t.a}</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn btn-sm btn-outline" id="btn-t-${timerId}" onclick="toggleTimer('${timerId}')"><i class="fas fa-play"></i></button>
                    <span id="time-${timerId}" style="font-family:monospace; font-weight:800; color:var(--accent);">00:00</span>
                </div>
            </div>
            <input type="checkbox" ${t.c ? 'checked' : ''} onclick="${checkAction}">
        </div>`;
}

function getAtrasosDaSemana(hoje) {
    const pD = new Date(hoje);
    pD.setDate(hoje.getDate() - hoje.getDay());
    const atrasos = [];
    for(let i=0; i<hoje.getDay(); i++) {
        const d = new Date(pD);
        d.setDate(pD.getDate() + i);
        const k = dateKey(d);
        (db.metaFixa[k] || []).filter(t => !t.c).forEach(task => atrasos.push({task, dia: k}));
    }
    return atrasos;
}

function toggleTimer(id) {
    if(timers[id]) {
        clearInterval(timers[id].interval);
        delete timers[id];
        document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-play"></i>';
        return;
    }
    const display = document.getElementById(`time-${id}`);
    const parts = display.innerText.split(':');
    let sec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    timers[id] = {
        interval: setInterval(() => {
            sec++;
            display.innerText = `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;
        }, 1000)
    };
    document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-pause"></i>';
}

function fecharModais() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

function abrirModalExtra() {
    const selectMat = document.getElementById('extra-mat');
    const materiasUnicas = [...new Set(db.lista.map(x => x.m))];
    selectMat.innerHTML = '<option value="">Selecione a Matéria</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
    document.getElementById('modal-extra').style.display = 'flex';
}

function atualizarAssuntosExtra() {
    const mat = document.getElementById('extra-mat').value;
    const selectAss = document.getElementById('extra-ass');
    if(!mat) { selectAss.innerHTML = '<option value="">Selecione o Assunto</option>'; return; }
    const assuntos = [...new Set(db.lista.filter(x => x.m === mat).map(x => x.a))];
    selectAss.innerHTML = assuntos.map(a => `<option value="${a}">${a}</option>`).join('');
}

function concluirTask(t, dK) {
    if(t.c) return;
    concluirTaskNoState(t, dK, db);
    if(t.k === 'E') verificarTeoriaSuficiente(t, dK);
}

function verificarTeoriaSuficiente(t, dK) {
    const item = db.lista.find(x => x.id === t.itemId);
    if(!item || !item.done.E || item.f || t.extraTeoriaPerguntada) return;
    t.extraTeoriaPerguntada = true;
    teoriaPendente = { dK, itemId: item.id };
    document.getElementById('label-teoria-assunto').innerText = `${item.m} - ${item.a}`;
    document.getElementById('teoria-step-1').style.display = 'block';
    document.getElementById('teoria-step-2').style.display = 'none';
    document.getElementById('teoria-extra-horas').value = '1';
    document.getElementById('modal-teoria').style.display = 'flex';
}

function confirmarTeoriaSuficiente() {
    teoriaPendente = null;
    fecharModais();
    save();
    updateDashboard();
    renderDiarioSemRecalcular(vDate);
}

function mostrarTempoExtraTeoria() {
    document.getElementById('teoria-step-1').style.display = 'none';
    document.getElementById('teoria-step-2').style.display = 'block';
}

function aplicarTempoExtraTeoria(destino) {
    if(!teoriaPendente) return;
    const item = db.lista.find(x => x.id === teoriaPendente.itemId);
    const horas = Math.max(0, parseFloat(document.getElementById('teoria-extra-horas').value) || 0);
    if(!item || horas <= 0) return;

    item.h.E += horas;
    item.extraTeoria += horas;
    item.done.E = false;
    item.done.Rev = false;
    item.done.Ex = false;
    item.f = false;
    item.revCycle = null;

    if(destino === 'hoje') inserirTeoriaExtraNoDia(item, teoriaPendente.dK, horas);
    limparPlanejamentoFuturo(teoriaPendente.dK);
    teoriaPendente = null;
    fecharModais();
    save();
    showToast("Tempo extra planejado", destino === 'hoje' ? "O reforço foi tentado no dia atual." : "Os próximos dias foram recalculados sem alterar dias anteriores.");
    updateDashboard();
    renderDiarioSemRecalcular(vDate);
}

function inserirTeoriaExtraNoDia(item, diaKey, horas) {
    const data = keyToDate(diaKey);
    const limite = parseFloat(db.h[data.getDay()]) || 0;
    const tasks = db.metaFixa[diaKey] || [];
    const total = tarefasPlanejadas(tasks).reduce((acc, t) => acc + (parseFloat(t.h) || 0), 0);
    const livre = Math.max(0, limite - total);
    if(livre <= 0.01) {
        showToast("Sem espaço hoje", "A teoria extra entrará no próximo dia disponível do cronograma.");
        return;
    }
    const horasHoje = Math.min(livre, horas);
    tasks.push(criarTask(item, 'E', horasHoje, diaKey));
    db.metaFixa[diaKey] = tasks;
    showToast("Teoria extra adicionada", `${horasHoje.toFixed(1)}h foram encaixadas hoje.`);
}

function cliqueTask(dK, idx) {
    const t = db.metaFixa[dK][idx];
    if(!t.c && t.k === 'Ex') {
        exPendente = { dK, idx };
        document.getElementById('label-ex-assunto').innerText = `${t.m} - ${t.a}`;
        document.getElementById('modal-exercicio').style.display = 'flex';
    } else if(!t.c) {
        concluirTask(t, dK);
        save();
        updateDashboard();
        renderDiarioSemRecalcular(vDate);
    } else {
        desmarcarLancamento(dK, idx, false);
        save();
        updateDashboard();
        renderDiarioSemRecalcular(vDate);
    }
}

function listarLancamentos() {
    const lista = [];
    Object.keys(db.metaFixa || {}).forEach(dia => {
        (db.metaFixa[dia] || []).forEach((task, idx) => {
            if(task.c) lista.push({dia, idx, task});
        });
    });
    return lista.sort((a, b) => keyToDate(b.dia) - keyToDate(a.dia));
}

function renderLancamentos() {
    const alvo = document.getElementById('lancamentos-content');
    if(!alvo) return;
    const lancamentos = listarLancamentos();
    if(!lancamentos.length) {
        alvo.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-database"></i>
                <strong>Nenhum lançamento registrado</strong>
                <span>Quando você marcar uma atividade como feita, ela aparecerá aqui.</span>
            </div>`;
        return;
    }
    alvo.innerHTML = `
        <div class="lancamentos-list">
            ${lancamentos.map(({dia, idx, task}) => `
                <div class="lancamento-row">
                    <div class="lancamento-date">
                        <strong>${dia.slice(0,5)}</strong>
                        <span>${dia}</span>
                    </div>
                    <div class="lancamento-main">
                        <span class="tag tag-${task.k==='Ex'?'ex':(task.k==='Rev'?'rev':'e')}">${task.l}</span>
                        <b>${task.m}</b>
                        <small>${task.a}</small>
                    </div>
                    <div class="lancamento-hours">${(parseFloat(task.h) || 0).toFixed(1)}h</div>
                    <button class="btn btn-sm btn-outline danger-btn" onclick="removerLancamento('${dia}', ${idx})">
                        <i class="fas fa-trash"></i> REMOVER
                    </button>
                </div>`).join('')}
        </div>`;
}

function showPerfTab(id, el) {
    document.querySelectorAll('.perf-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.perf-tab').forEach(t => t.classList.remove('active'));
    const page = document.getElementById(`perf-${id}`);
    if(page) page.classList.add('active');
    if(el) el.classList.add('active');
}

function renderPerformance() {
    const data = getPerformanceData();
    renderPerfGeral(data);
    renderPerfQuestoes(data);
    renderPerfMelhores(data);
    renderPerfPrioridades(data);
}

function renderPerfil() {
    const alvo = document.getElementById('perfil-content');
    if(!alvo) return;
    const nome = nomeUsuario();
    const email = emailUsuario();
    const login = loginUsuario();
    const avatar = avatarUsuario();
    const nomeSeguro = escapeHtml(nome);
    const emailSeguro = escapeHtml(email);
    const loginSeguro = escapeHtml(login);
    const avatarSeguro = escapeHtml(avatar);
    const iniciais = nome
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0]?.toUpperCase())
        .join('') || 'P';
    const sincronizado = cloudUser ? 'Sincronização ativa' : 'Acesso local';
    const detalhe = cloudUser
        ? (editandoAlunoComoAdmin() ? `Você está editando os dados de ${adminStudentContext.email}.` : 'Este perfil usa sua conta Google para carregar e salvar os dados no Supabase.')
        : 'Entre com Google para sincronizar seus dados entre celular, tablet e computador.';
    const statusAcesso = accessProfile?.status === 'approved' ? 'Aprovado' : (accessProfile?.status === 'pending' ? 'Pendente' : (accessProfile?.status === 'rejected' ? 'Recusado' : sincronizado));
    const adminHtml = usuarioAdmin() ? `
            <div class="stat-card admin-access-card">
                <div class="admin-access-head">
                    <div>
                        <h3>Aprovar alunos</h3>
                        <p class="meta-sub">Controle quem pode acessar o Plantão como aluno e abra o perfil para fazer ajustes.</p>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="carregarSolicitacoesAcesso()">
                        <i class="fas fa-rotate"></i> ATUALIZAR
                    </button>
                </div>
                <div id="admin-access-list" class="admin-access-list">
                    <div class="empty-state">Carregando solicitações...</div>
                </div>
            </div>` : '';

    alvo.innerHTML = `
        <div class="profile-grid">
            <div class="stat-card profile-main-card">
                <div class="profile-avatar">
                    ${avatar ? `<img src="${avatarSeguro}" alt="Foto de perfil">` : `<span>${iniciais}</span>`}
                </div>
                <div>
                    <small>Conta conectada</small>
                    <h3>${nomeSeguro}</h3>
                    <p>${detalhe}</p>
                </div>
            </div>
            <div class="stat-card profile-info-card">
                <div class="profile-info-row">
                    <span>Nome</span>
                    <strong>${nomeSeguro}</strong>
                </div>
                <div class="profile-info-row">
                    <span>E-mail</span>
                    <strong>${emailSeguro}</strong>
                </div>
                <div class="profile-info-row">
                    <span>Login</span>
                    <strong>${loginSeguro}</strong>
                </div>
                <div class="profile-info-row">
                    <span>Status</span>
                    <strong>${statusAcesso}</strong>
                </div>
            </div>
            <div class="stat-card profile-actions-card">
                <h3>Nome na plataforma</h3>
                <p class="meta-sub">Esse nome aparece no painel, no ranking e nas áreas de acompanhamento.</p>
                <label for="perfil-nome-aluno">Nome exibido</label>
                <input type="text" id="perfil-nome-aluno" value="${nomeSeguro}" maxlength="80" placeholder="Nome do aluno">
                <button class="btn" onclick="salvarNomePerfil()">
                    <i class="fas fa-user-check"></i> SALVAR NOME
                </button>
            </div>
            <div class="stat-card profile-actions-card">
                <h3>Acesso</h3>
                <p class="meta-sub">Saia desta conta para entrar com outro Google neste dispositivo.</p>
                <button class="btn btn-outline" onclick="sairGoogle()">
                    <i class="fas fa-right-from-bracket"></i> SAIR DO LOGIN
                </button>
            </div>
            <div class="stat-card profile-deadline-card">
                <h3>Data do edital</h3>
                <p class="meta-sub">Informe a data prevista de publicação para o painel acompanhar a contagem.</p>
                <label for="edital-publicacao">Publicação do edital</label>
                <input type="date" id="edital-publicacao" value="${escapeHtml(db.editalPublicacao || '')}">
                <div class="deadline-preview">${escapeHtml(textoDataEdital() || 'Nenhuma data definida.')}</div>
                <button class="btn" onclick="salvarDataEdital()">
                    <i class="fas fa-calendar-check"></i> SALVAR DATA
                </button>
            </div>
            ${adminHtml}
        </div>`;
    if(usuarioAdmin()) carregarSolicitacoesAcesso();
    renderAdminStudentBanner();
}

async function carregarSolicitacoesAcesso() {
    const alvo = document.getElementById('admin-access-list');
    if(!alvo || !supabaseClient || !usuarioAdmin()) return;
    alvo.innerHTML = '<div class="empty-state">Carregando solicitações...</div>';
    try {
        const adminEmailAtual = emailUsuario();
        try {
            await verificarAcessoSupabase();
        } catch(e) {}
        const { data, error } = await comTimeout(
            supabaseClient
                .from(ACCESS_TABLE)
                .select('*')
                .order('requested_at', { ascending: false }),
            8000,
            'Tempo esgotado ao carregar solicitações.'
        );
        if(error) throw error;
        adminAccessList = data || [];
        renderAdminAccessList(adminEmailAtual);
    } catch(e) {
        alvo.innerHTML = `
            <div class="empty-state">
                <strong>Não foi possível carregar os alunos</strong>
                <span>${escapeHtml(mensagemErroSupabase(e))}</span>
                <span>Sessão admin: ${escapeHtml(emailUsuario())} | token ${supabaseAccessToken ? 'ativo' : 'ausente'}</span>
                <span>Rode novamente o SQL de acesso no Supabase e depois peça para o aluno sair e entrar com Google.</span>
                <button class="btn btn-sm btn-outline" onclick="carregarSolicitacoesAcesso()">TENTAR NOVAMENTE</button>
            </div>`;
    }
}

function renderAdminAccessList(adminEmailAtual = '') {
    const alvo = document.getElementById('admin-access-list');
    if(!alvo) return;
    const alunos = adminAccessList.filter(item => item.email !== ADMIN_EMAIL);
    if(!alunos.length) {
        alvo.innerHTML = `
            <div class="empty-state">
                <strong>Nenhuma solicitação de aluno por enquanto</strong>
                <span>Admin conectado: ${escapeHtml(adminEmailAtual || emailUsuario())}</span>
                <span>Para aparecer aqui, o aluno precisa clicar em Entrar com Google. Se ele já testou, rode o SQL atualizado no Supabase.</span>
            </div>`;
        return;
    }
    alvo.innerHTML = alunos.map(item => {
        const email = escapeHtml(item.email || '');
        const emailParam = encodeURIComponent(item.email || '');
        const nome = escapeHtml(item.name || item.email || 'Aluno');
        const telefone = escapeHtml(item.phone || 'Sem telefone');
        const concurso = escapeHtml(item.contest || 'Concurso não informado');
        const idade = item.age ? `${escapeHtml(item.age)} anos` : 'Idade não informada';
        const status = escapeHtml(item.status || 'pending');
        const role = escapeHtml(item.role || 'aluno');
        const statusLabel = item.status === 'approved' ? 'Aprovado' : (item.status === 'rejected' ? 'Recusado' : 'Pendente');
        const editar = item.status === 'approved'
            ? `<button class="btn btn-sm btn-outline" onclick="entrarPerfilAluno('${emailParam}')">EDITAR PERFIL</button>`
            : '';
        const restaurar = item.status === 'approved'
            ? `<button class="btn btn-sm btn-outline danger-btn" onclick="restaurarBackupAluno('${emailParam}')">RESTAURAR BACKUP</button>`
            : '';
        const actions = item.status === 'approved'
            ? `${editar}${restaurar}<button class="btn btn-sm btn-outline danger-btn" onclick="alterarAcessoAluno('${emailParam}', 'rejected')">REVOGAR</button>
               <button class="btn btn-sm btn-outline danger-btn" onclick="excluirAlunoPlataforma('${emailParam}')">EXCLUIR</button>`
            : `<button class="btn btn-sm" onclick="alterarAcessoAluno('${emailParam}', 'approved')">APROVAR</button>
               <button class="btn btn-sm btn-outline danger-btn" onclick="alterarAcessoAluno('${emailParam}', 'rejected')">RECUSAR</button>
               <button class="btn btn-sm btn-outline danger-btn" onclick="excluirAlunoPlataforma('${emailParam}')">EXCLUIR</button>`;
        return `
            <div class="admin-access-row">
                <div>
                    <b>${nome}</b>
                    <small>${email}</small>
                    <small>${telefone} | ${idade}</small>
                    <small>${concurso}</small>
                </div>
                <span class="access-pill ${status}">${statusLabel} | ${role}</span>
                <div class="admin-access-actions">${actions}</div>
            </div>`;
    }).join('');
}

function renderAdminStudentBanner() {
    const banner = document.getElementById('admin-student-banner');
    if(!banner) return;
    if(!editandoAlunoComoAdmin()) {
        banner.style.display = 'none';
        banner.innerHTML = '';
        return;
    }
    banner.style.display = 'flex';
    banner.innerHTML = `
        <div>
            <strong>Editando perfil de aluno</strong>
            <span>${escapeHtml(adminStudentContext.name || 'Aluno')} | ${escapeHtml(adminStudentContext.email || '')}</span>
        </div>
        <button class="btn btn-sm btn-outline" onclick="voltarPerfilAdmin()">
            <i class="fas fa-user-shield"></i> VOLTAR PARA ADMIN
        </button>`;
}

async function entrarPerfilAluno(email) {
    if(!supabaseClient || !usuarioAdmin()) return;
    const cleanEmail = decodeURIComponent(String(email || '')).toLowerCase();
    const aluno = adminAccessList.find(item => String(item.email || '').toLowerCase() === cleanEmail);
    if(!aluno || aluno.status !== 'approved') {
        showToast('Aluno não aprovado', 'Aprove o aluno antes de abrir o perfil.');
        return;
    }
    if(!aluno.user_id) {
        showToast('Aluno sem login completo', 'Esse aluno precisa entrar pelo Google uma vez antes de você editar os dados dele.');
        return;
    }
    await salvarDadosSupabase(true);
    adminStudentContext = {
        user_id: aluno.user_id,
        email: cleanEmail,
        name: aluno.name || cleanEmail
    };
    adminEditBackupReady = false;
    const carregou = await carregarDadosSupabase();
    if(!carregou) {
        adminStudentContext = null;
        adminEditBackupReady = false;
        await carregarDadosSupabase();
        return;
    }
    renderAdminStudentBanner();
    renderPerfil();
    showTab('diaria', document.querySelector('.nav-item'));
}

async function voltarPerfilAdmin() {
    if(!editandoAlunoComoAdmin()) return;
    await salvarDadosSupabase(true);
    adminStudentContext = null;
    adminEditBackupReady = false;
    await carregarDadosSupabase();
    renderAdminStudentBanner();
    renderPerfil();
    showTab('perfil', document.querySelector(".nav-item[onclick*='perfil']"));
    showToast('Perfil admin restaurado', 'Você voltou para os seus dados.');
}

async function restaurarBackupAluno(email) {
    if(!supabaseClient || !usuarioAdmin()) return;
    const cleanEmail = decodeURIComponent(String(email || '')).toLowerCase();
    const aluno = adminAccessList.find(item => String(item.email || '').toLowerCase() === cleanEmail);
    if(!aluno?.user_id) {
        showToast('Aluno sem registro', 'Não encontrei o usuário do aluno para restaurar.');
        return;
    }
    try {
        const { data, error } = await supabaseClient
            .from('plantao_admin_backups')
            .select('before_data, created_at')
            .eq('student_user_id', aluno.user_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if(error) throw error;
        if(!data?.before_data) {
            showToast('Sem backup encontrado', 'Ainda não existe backup salvo para este aluno.');
            return;
        }
        const { error: saveError } = await supabaseClient
            .from('plantao_user_data')
            .upsert({
                user_id: aluno.user_id,
                data: data.before_data,
                email: cleanEmail,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        if(saveError) throw saveError;
        if(editandoAlunoComoAdmin() && adminStudentContext.user_id === aluno.user_id) {
            db = cloneDados(data.before_data);
            localStorage.setItem('prf_v120', JSON.stringify(db));
            normalizarBanco();
            init();
        }
        showToast('Backup restaurado', `Dados de ${cleanEmail} voltaram para o último backup.`);
    } catch(e) {
        showToast('Falha ao restaurar backup', 'Confira as permissões da tabela plantao_admin_backups.');
    }
}

async function alterarAcessoAluno(email, status) {
    if(!supabaseClient || !usuarioAdmin()) return;
    const cleanEmail = decodeURIComponent(String(email || '')).toLowerCase();
    if(!cleanEmail || cleanEmail === ADMIN_EMAIL) return;
    const payload = {
        status,
        role: 'aluno',
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        approved_by: status === 'approved' ? ADMIN_EMAIL : null
    };
    try {
        const { error } = await supabaseClient
            .from(ACCESS_TABLE)
            .update(payload)
            .eq('email', cleanEmail);
        if(error) throw error;
        showToast(status === 'approved' ? 'Aluno aprovado' : 'Acesso atualizado', cleanEmail);
        await carregarSolicitacoesAcesso();
    } catch(e) {
        showToast('Falha ao atualizar acesso', 'Confira as permissões da tabela no Supabase.');
    }
}

async function excluirAlunoPlataforma(email) {
    if(!supabaseClient || !usuarioAdmin()) return;
    const cleanEmail = decodeURIComponent(String(email || '')).toLowerCase();
    if(!cleanEmail || cleanEmail === ADMIN_EMAIL) return;
    const aluno = adminAccessList.find(item => String(item.email || '').toLowerCase() === cleanEmail);
    if(!confirm(`Excluir ${cleanEmail} da plataforma? Os dados de planejamento deste aluno também serão removidos.`)) return;
    try {
        if(aluno?.user_id) {
            const { error: dataError } = await supabaseClient
                .from('plantao_user_data')
                .delete()
                .eq('user_id', aluno.user_id);
            if(dataError) throw dataError;
        }
        const { error } = await supabaseClient
            .from(ACCESS_TABLE)
            .delete()
            .eq('email', cleanEmail);
        if(error) throw error;
        if(editandoAlunoComoAdmin() && adminStudentContext?.email === cleanEmail) {
            await voltarPerfilAdmin();
        }
        showToast('Aluno excluído', `${cleanEmail} foi removido da plataforma.`);
        await carregarSolicitacoesAcesso();
    } catch(e) {
        showToast('Falha ao excluir aluno', 'Confira as permissões de exclusão no SQL do Supabase.');
    }
}

async function salvarNomePerfil() {
    const input = document.getElementById('perfil-nome-aluno');
    if(!input) return;
    const nome = input.value.trim();
    if(nome.length < 2) {
        showToast('Nome não salvo', 'Informe pelo menos 2 letras.');
        return;
    }
    db.perfilNome = nome;
    salvarPreferenciasLocais();
    save();
    atualizarPersonalizacao();
    renderPerfil();
    try {
        const alvo = alvoDadosNuvem();
        if(supabaseClient && alvo.email) {
            await supabaseClient
                .from(ACCESS_TABLE)
                .update({ name: nome, user_id: alvo.user_id || null })
                .eq('email', String(alvo.email).toLowerCase());
        }
        await salvarDadosSupabase(true);
    } catch(e) {}
    showToast('Nome atualizado', `${nome} será usado na plataforma.`);
}

function salvarDataEdital() {
    const input = document.getElementById('edital-publicacao');
    if(!input) return;
    db.editalPublicacao = input.value || '';
    salvarPreferenciasLocais();
    save();
    salvarDadosSupabase(true);
    renderPerfil();
    atualizarProgressoCiclo();
    showToast('Data do edital salva', textoDataEdital() || 'A contagem do edital foi removida do painel.');
}

function getPerformanceData() {
    const lancamentos = listarLancamentos().filter(x => !isExtraTask(x.task));
    const porMateria = {};
    const porAssunto = {};
    const ensure = (obj, key, extra = {}) => {
        if(!obj[key]) obj[key] = { nome: key, horas: 0, questoes: 0, acertos: 0, atividades: 0, estudos: 0, revisoes: 0, exercicios: 0, ...extra };
        return obj[key];
    };

    lancamentos.forEach(({task}) => {
        const horas = parseFloat(task.h) || 0;
        const mat = ensure(porMateria, task.m);
        const ass = ensure(porAssunto, `${task.m}||${task.a}`, { materia: task.m, assunto: task.a });
        [mat, ass].forEach(alvo => {
            alvo.horas += horas;
            alvo.atividades++;
            if(task.k === 'E') alvo.estudos++;
            if(task.k === 'Rev') alvo.revisoes++;
            if(task.k === 'Ex') alvo.exercicios++;
            if(task.perf) {
                alvo.questoes += parseInt(task.perf.t) || 0;
                alvo.acertos += parseInt(task.perf.a) || 0;
            }
        });
    });

    const total = Object.values(porMateria).reduce((acc, item) => {
        acc.horas += item.horas;
        acc.questoes += item.questoes;
        acc.acertos += item.acertos;
        acc.atividades += item.atividades;
        acc.estudos += item.estudos;
        acc.revisoes += item.revisoes;
        acc.exercicios += item.exercicios;
        return acc;
    }, { horas: 0, questoes: 0, acertos: 0, atividades: 0, estudos: 0, revisoes: 0, exercicios: 0 });

    return {
        lancamentos,
        total,
        materias: Object.values(porMateria),
        assuntos: Object.values(porAssunto)
    };
}

function taxa(item) {
    return item.questoes ? Math.round((item.acertos / item.questoes) * 100) : 0;
}

function perfEmpty(texto) {
    return `
        <div class="empty-state">
            <i class="fas fa-chart-line"></i>
            <strong>Sem dados suficientes</strong>
            <span>${texto}</span>
        </div>`;
}

function renderPerfGeral(data) {
    const el = document.getElementById('perf-geral');
    if(!el) return;
    const total = data.total;
    el.innerHTML = `
        <div class="perf-kpi-grid">
            <div class="perf-kpi"><small>Horas estudadas</small><strong>${total.horas.toFixed(1)}h</strong></div>
            <div class="perf-kpi"><small>Questões feitas</small><strong>${total.questoes}</strong></div>
            <div class="perf-kpi"><small>Questões acertadas</small><strong>${total.acertos}</strong></div>
            <div class="perf-kpi"><small>Precisão geral</small><strong>${taxa(total)}%</strong></div>
        </div>
        <div class="perf-grid">
            <div class="stat-card">
                <h3>Distribuição dos lançamentos</h3>
                ${perfMetricBar('Estudo', total.estudos, total.atividades)}
                ${perfMetricBar('Revisão', total.revisoes, total.atividades)}
                ${perfMetricBar('Exercícios', total.exercicios, total.atividades)}
            </div>
            <div class="stat-card">
                <h3>Matérias mais trabalhadas</h3>
                ${renderRankList(data.materias.sort((a,b) => b.horas - a.horas).slice(0,5), 'horas')}
            </div>
        </div>`;
}

function perfMetricBar(label, value, total) {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return `
        <div class="perf-metric">
            <div><span>${label}</span><b>${value}</b></div>
            <div class="mini-bar"><div style="width:${pct}%"></div></div>
        </div>`;
}

function renderRankList(items, mode) {
    if(!items.length) return perfEmpty('Marque atividades como concluídas para gerar análise.');
    return `<div class="perf-rank-list">${items.map((item, idx) => `
        <div class="perf-rank-row">
            <span>${idx + 1}</span>
            <div>
                <b>${item.assunto || item.nome}</b>
                <small>${item.materia ? item.materia + ' | ' : ''}${item.horas.toFixed(1)}h | ${item.questoes} questões | ${taxa(item)}%</small>
            </div>
            <strong>${mode === 'taxa' ? taxa(item) + '%' : item.horas.toFixed(1) + 'h'}</strong>
        </div>`).join('')}</div>`;
}

function renderPerfQuestoes(data) {
    const el = document.getElementById('perf-questoes');
    if(!el) return;
    const materiasComQuestoes = data.materias.filter(x => x.questoes > 0).sort((a,b) => b.questoes - a.questoes);
    el.innerHTML = `
        <div class="perf-grid">
            <div class="stat-card">
                <h3>Questões por matéria</h3>
                ${materiasComQuestoes.length ? materiasComQuestoes.map(m => perfQuestionRow(m.nome, m.questoes, m.acertos)).join('') : perfEmpty('Registre exercícios para ver questões por matéria.')}
            </div>
            <div class="stat-card">
                <h3>Melhores assuntos</h3>
                ${renderRankList(data.assuntos.filter(x => x.questoes > 0).sort((a,b) => taxa(b) - taxa(a)).slice(0,8), 'taxa')}
            </div>
            <div class="stat-card perf-subject-card">
                <h3>Desempenho por assunto</h3>
                <p class="meta-sub">Cada assunto aparece dentro da sua matéria com questões feitas, acertos e precisão.</p>
                ${renderAssuntosQuestoesPorMateria(data)}
            </div>
        </div>`;
}

function perfQuestionRow(nome, questoes, acertos) {
    const pct = questoes ? Math.round((acertos / questoes) * 100) : 0;
    return `
        <div class="perf-question-row">
            <div><b>${nome}</b><small>${acertos}/${questoes} acertos</small></div>
            <strong>${pct}%</strong>
            <div class="mini-bar"><div style="width:${pct}%"></div></div>
        </div>`;
}

function renderAssuntosQuestoesPorMateria(data) {
    const assuntos = data.assuntos
        .filter(x => x.questoes > 0)
        .sort((a,b) => String(a.materia).localeCompare(String(b.materia), 'pt-BR') || taxa(b) - taxa(a) || String(a.assunto).localeCompare(String(b.assunto), 'pt-BR'));
    if(!assuntos.length) return perfEmpty('Registre exercícios para ver seu desempenho por assunto.');

    const porMateria = assuntos.reduce((acc, item) => {
        const materia = item.materia || 'Matéria não informada';
        if(!acc[materia]) acc[materia] = [];
        acc[materia].push(item);
        return acc;
    }, {});

    return Object.entries(porMateria).map(([materia, itens]) => {
        const total = itens.reduce((acc, item) => {
            acc.questoes += item.questoes;
            acc.acertos += item.acertos;
            return acc;
        }, { questoes: 0, acertos: 0 });
        return `
            <div class="perf-subject-group">
                <div class="perf-subject-head">
                    <div>
                        <b>${escapeHtml(materia)}</b>
                        <small>${total.acertos}/${total.questoes} acertos | ${taxa(total)}%</small>
                    </div>
                </div>
                ${itens.map(item => perfQuestionRow(escapeHtml(item.assunto || 'Assunto não informado'), item.questoes, item.acertos)).join('')}
            </div>`;
    }).join('');
}

function renderPerfMelhores(data) {
    const el = document.getElementById('perf-melhores');
    if(!el) return;
    const melhoresMaterias = data.materias.filter(x => x.questoes > 0).sort((a,b) => taxa(b) - taxa(a) || b.questoes - a.questoes).slice(0,8);
    const melhoresAssuntos = data.assuntos.filter(x => x.questoes > 0).sort((a,b) => taxa(b) - taxa(a) || b.questoes - a.questoes).slice(0,8);
    el.innerHTML = `
        <div class="perf-grid">
            <div class="stat-card"><h3>Matérias em que você está melhor</h3>${renderRankList(melhoresMaterias, 'taxa')}</div>
            <div class="stat-card"><h3>Assuntos em que você está melhor</h3>${renderRankList(melhoresAssuntos, 'taxa')}</div>
        </div>`;
}

function renderPerfPrioridades(data) {
    const el = document.getElementById('perf-prioridades');
    if(!el) return;
    const ativas = db.ciclo.length ? db.ciclo : [...new Set(db.lista.map(x => x.m))];
    const materias = ativas.map(m => {
        const atual = data.materias.find(x => x.nome === m) || { nome: m, horas: 0, questoes: 0, acertos: 0, atividades: 0 };
        const assuntos = db.lista.filter(x => x.m === m);
        const pendentes = assuntos.filter(x => !x.f).length;
        return { ...atual, pendentes };
    });
    const prioridades = materias.sort((a,b) => prioridadeScore(b) - prioridadeScore(a)).slice(0,8);
    el.innerHTML = `
        <div class="stat-card">
            <h3>Em quais matérias devo estudar</h3>
            <p class="meta-sub">Prioridade calculada por baixa precisão, poucas questões, poucas horas e assuntos pendentes.</p>
            ${prioridades.length ? prioridades.map(renderPrioridadeRow).join('') : perfEmpty('Ative matérias no ciclo para gerar prioridades.')}
        </div>`;
}

function prioridadeScore(item) {
    const baixaPrecisao = item.questoes ? Math.max(0, 100 - taxa(item)) : 35;
    const poucasQuestoes = item.questoes < 20 ? 25 : 0;
    const poucasHoras = item.horas < 3 ? 20 : 0;
    const pendencia = Math.min(30, (item.pendentes || 0) * 5);
    return baixaPrecisao + poucasQuestoes + poucasHoras + pendencia;
}

function renderPrioridadeRow(item) {
    const pct = Math.min(100, prioridadeScore(item));
    const motivo = item.questoes === 0 ? 'sem questões registradas' : `${taxa(item)}% de precisão`;
    return `
        <div class="priority-row">
            <div>
                <b>${item.nome}</b>
                <small>${motivo} | ${item.horas.toFixed(1)}h estudadas | ${item.pendentes || 0} assunto(s) pendente(s)</small>
            </div>
            <span>${pct}% prioridade</span>
            <div class="mini-bar"><div style="width:${pct}%"></div></div>
        </div>`;
}

function listarLancamentosBanco(banco) {
    const lista = [];
    Object.keys(banco?.metaFixa || {}).forEach(dia => {
        (banco.metaFixa[dia] || []).forEach(task => {
            if(task.c && !isExtraTask(task)) lista.push({ dia, task });
        });
    });
    return lista;
}

function calcularStreakBanco(banco) {
    let streak = 0;
    const d = new Date();
    while(true) {
        const k = dateKey(d);
        const tarefas = tarefasPlanejadas(banco?.metaFixa?.[k] || []);
        if(tarefas.length && tarefas.every(t => t.c)) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

function resumoRankingAluno(aluno, dados) {
    const banco = dados || {};
    const lancamentos = listarLancamentosBanco(banco);
    const total = lancamentos.reduce((acc, { task }) => {
        acc.horas += parseFloat(task.h) || 0;
        if(task.perf) {
            acc.questoes += parseInt(task.perf.t) || 0;
            acc.acertos += parseInt(task.perf.a) || 0;
        }
        return acc;
    }, { horas: 0, questoes: 0, acertos: 0 });
    return {
        nome: banco.perfilNome || aluno.name || aluno.email || 'Aluno',
        email: aluno.email || '',
        horas: total.horas,
        questoes: total.questoes,
        acertos: total.acertos,
        taxa: total.questoes ? Math.round((total.acertos / total.questoes) * 100) : 0,
        streak: calcularStreakBanco(banco)
    };
}

function rankingLista(titulo, subtitulo, alunos, criterio, unidade) {
    const ordenados = [...alunos].sort((a, b) => b[criterio] - a[criterio] || a.nome.localeCompare(b.nome));
    return `
        <div class="stat-card ranking-card">
            <div class="ranking-card-head">
                <h3>${titulo}</h3>
                <p class="meta-sub">${subtitulo}</p>
            </div>
            ${ordenados.length ? ordenados.map((aluno, idx) => `
                <div class="ranking-row">
                    <span class="ranking-pos">${idx + 1}</span>
                    <div>
                        <b>${escapeHtml(aluno.nome)}</b>
                        <small>${escapeHtml(aluno.email)} | ${aluno.horas.toFixed(1)}h | ${aluno.questoes} questões | ${aluno.taxa}%</small>
                    </div>
                    <strong>${criterio === 'horas' ? aluno[criterio].toFixed(1) : aluno[criterio]}${unidade}</strong>
                </div>`).join('') : perfEmpty('Ainda não há alunos com dados para ranquear.')}
        </div>`;
}

async function renderRankingAlunos() {
    const alvo = document.getElementById('ranking-content');
    if(!alvo) return;
    if(!usuarioAdmin()) {
        alvo.innerHTML = perfEmpty('O ranking fica disponível somente para o admin.');
        return;
    }
    alvo.innerHTML = '<div class="empty-state">Carregando ranking dos alunos...</div>';
    try {
        if(!adminAccessList.length) await carregarSolicitacoesAcesso();
        const alunos = adminAccessList.filter(item => item.email !== ADMIN_EMAIL && item.status === 'approved' && item.user_id);
        if(!alunos.length) {
            alvo.innerHTML = perfEmpty('Aprove alunos e aguarde eles salvarem atividades para montar o ranking.');
            return;
        }
        const ids = alunos.map(a => a.user_id);
        const { data, error } = await comTimeout(
            supabaseClient
                .from('plantao_user_data')
                .select('user_id,email,data')
                .in('user_id', ids),
            9000,
            'Tempo esgotado ao carregar dados dos alunos.'
        );
        if(error) throw error;
        const dadosPorId = new Map((data || []).map(item => [item.user_id, item.data || {}]));
        const ranking = alunos.map(aluno => resumoRankingAluno(aluno, dadosPorId.get(aluno.user_id)));
        alvo.innerHTML = `
            <div class="ranking-grid">
                ${rankingLista('Horas estudadas', 'Soma de atividades concluídas.', ranking, 'horas', 'h')}
                ${rankingLista('Precisão de acertos', 'Percentual geral de acertos em questões.', ranking.filter(a => a.questoes > 0), 'taxa', '%')}
                ${rankingLista('Dias sem falhar', 'Sequência atual de dias com todas as metas concluídas.', ranking, 'streak', ' dias')}
            </div>`;
    } catch(e) {
        alvo.innerHTML = `
            <div class="empty-state">
                <strong>Não foi possível carregar o ranking</strong>
                <span>${escapeHtml(mensagemErroSupabase(e))}</span>
                <span>Confira se o SQL do Supabase permite o admin ler plantao_user_data.</span>
            </div>`;
    }
}

function removerLancamento(dia, idx) {
    desmarcarLancamento(dia, idx, true);
}

function desmarcarLancamento(dia, idx, voltarParaBase) {
    const task = db.metaFixa?.[dia]?.[idx];
    if(!task) return;
    task.c = false;
    task.perf = null;
    reconstruirProgressoPorLancamentos();
    save();
    updateDashboard();
    if(voltarParaBase) {
        renderLancamentos();
        showToast("Lançamento removido", "A atividade voltou para pendente e o progresso foi recalculado.");
    }
}

function reconstruirProgressoPorLancamentos() {
    db.lista.forEach(item => {
        if(item.sinalizado) {
            item.f = true;
            item.done = {E:true, Rev:true, Ex:true};
            item.hF = item.h.E;
            item.maintDone = Boolean(item.maintDone);
            item.revCycle = item.revCycle || { cycle: 1, stage: 'Rev', due: dateKey(addDays(new Date(), 1)) };
        } else {
            item.f = false;
            item.done = {E:false, Rev:false, Ex:false};
            item.hF = 0;
            item.lastInitialStudyDate = null;
            item.lastInitialRevDate = null;
            item.revCycle = null;
            item.maintDone = false;
            item.cicloConcluidoManual = false;
        }
    });

    Object.keys(db.metaFixa || {})
        .sort((a, b) => keyToDate(a) - keyToDate(b))
        .forEach(dia => {
            (db.metaFixa[dia] || []).forEach(task => {
                if(task.c && !isExtraTask(task)) concluirTaskNoState({...task}, dia, db);
            });
        });
}

function renderDiarioSemRecalcular(date) {
    const key = dateKey(date);
    if(!db.metaFixa[key]) return renderDiario(date);
    const original = garantirDiaPlanejado;
    garantirDiaPlanejado = function(){};
    renderDiario(date);
    garantirDiaPlanejado = original;
}

function calcCebraspe() {
    const total = Math.max(0, parseInt(document.getElementById('ex-total').value) || 0);
    const acertosInformados = Math.max(0, parseInt(document.getElementById('ex-acertos').value) || 0);
    const acertos = total > 0 ? Math.min(acertosInformados, total) : acertosInformados;
    const perc = total > 0 ? Math.round((acertos / total) * 100) : 0;
    const aviso = acertosInformados > total && total > 0 ? '<br><small>Acertos ajustados ao total de questões.</small>' : '';
    document.getElementById('cebraspe-feedback').innerHTML = total
        ? `Acertos: ${acertos}/${total} | Aproveitamento: ${perc}%${aviso}`
        : 'Informe as questões e os acertos.';
}

function confirmarExercicio() {
    const t = db.metaFixa[exPendente.dK][exPendente.idx];
    const total = Math.max(0, parseInt(document.getElementById('ex-total').value) || 0);
    const acertosInformados = Math.max(0, parseInt(document.getElementById('ex-acertos').value) || 0);
    t.perf = {
        t: total,
        a: total > 0 ? Math.min(acertosInformados, total) : acertosInformados
    };
    concluirTask(t, exPendente.dK);
    exPendente = null;
    document.getElementById('ex-total').value = '';
    document.getElementById('ex-acertos').value = '';
    save();
    fecharModais();
    updateDashboard();
    renderDiarioSemRecalcular(vDate);
}

function replanejarAgora() {
    const h = new Date(); h.setHours(0,0,0,0);
    const pD = new Date(h); pD.setDate(h.getDate() - h.getDay());
    for(let i=0; i<=h.getDay(); i++) {
        const d = new Date(pD); d.setDate(pD.getDate() + i);
        const k = dateKey(d);
        if(db.metaFixa[k]) db.metaFixa[k] = db.metaFixa[k].filter(t => t.c);
    }
    save();
    showToast("Plantão replanejado", "Os atrasos foram removidos do planejamento ativo.");
    init();
}

function renderReplanejamento() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const hojeKey = dateKey(hoje);
    const amanhaKey = dateKey(addDays(hoje, 1));
    const pausado = diaPausado(hojeKey);
    const atividadesHoje = tarefasPlanejadas(db.metaFixa[hojeKey] || []);
    const horasHoje = atividadesHoje.reduce((acc, t) => acc + (parseFloat(t.h) || 0), 0);
    const content = document.getElementById('replanejar-content');
    if(!content) return;

    content.innerHTML = `
        <div class="replan-grid">
            <div class="stat-card replan-card ${pausado ? 'active' : ''}">
                <div class="replan-icon"><i class="fas fa-calendar-plus"></i></div>
                <div>
                    <h3>Começar a semana amanhã</h3>
                    <p class="meta-sub">Esvazia o dia de hoje e recalcula o cronograma a partir de ${amanhaKey}, respeitando suas horas cadastradas.</p>
                </div>
                <div class="replan-status">
                    <span>${pausado ? 'Hoje esta pausado' : 'Hoje ainda esta ativo'}</span>
                    <strong>${horasHoje.toFixed(1)}h hoje</strong>
                </div>
                <button class="btn" onclick="replanejarComecarAmanha()">
                    <i class="fas fa-forward"></i> COMEÇAR AMANHA
                </button>
                ${pausado ? `<button class="btn btn-outline" onclick="reativarDiaAtual()"><i class="fas fa-undo"></i> REATIVAR HOJE</button>` : ''}
            </div>
            <div class="stat-card replan-note">
                <h3>O que acontece</h3>
                <div class="replan-steps">
                    <div><i class="fas fa-check"></i><span>Hoje fica sem cards planejados.</span></div>
                    <div><i class="fas fa-check"></i><span>As atividades não concluídas voltam para a fila.</span></div>
                    <div><i class="fas fa-check"></i><span>Amanhã assume o início do ciclo, sem marcar nada como estudado.</span></div>
                    <div><i class="fas fa-check"></i><span>Domingo a sabado continuam respeitando os limites diarios.</span></div>
                </div>
            </div>
        </div>`;
}

function replanejarComecarAmanha() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const hojeKey = dateKey(hoje);
    if(!Array.isArray(db.diasPausados)) db.diasPausados = [];
    if(!db.diasPausados.includes(hojeKey)) db.diasPausados.push(hojeKey);
    db.metaFixa[hojeKey] = [];
    limparPlanejamentoFuturo(hojeKey);
    save();
    showToast("Dia pausado", "Hoje ficou vazio e o cronograma recomeça amanhã.");
    renderReplanejamento();
    renderDiario(vDate);
    updateDashboard();
}

function reativarDiaAtual() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const hojeKey = dateKey(hoje);
    db.diasPausados = (db.diasPausados || []).filter(k => k !== hojeKey);
    delete db.metaFixa[hojeKey];
    limparPlanejamentoFuturo(hojeKey);
    save();
    showToast("Hoje reativado", "O planejamento de hoje voltou a ser calculado.");
    renderReplanejamento();
    renderDiario(vDate);
    updateDashboard();
}

function renderBackup() {
    const content = document.getElementById('backup-content');
    if(!content) return;
    const totalAssuntos = db.lista.length;
    const totalLancamentos = listarLancamentos().length;
    const ultimaCopia = db.ultimoBackup ? new Date(db.ultimoBackup).toLocaleString() : 'Nenhuma cópia registrada';

    content.innerHTML = `
        <div class="backup-grid">
            <div class="stat-card backup-card">
                <div class="backup-icon"><i class="fas fa-lock"></i></div>
                <h3>Exportar backup seguro</h3>
                <p class="meta-sub">Crie um arquivo criptografado. Guarde a senha, porque sem ela não será possível restaurar.</p>
                <label for="backup-pass">Senha do backup</label>
                <input type="password" id="backup-pass" placeholder="Digite uma senha forte">
                <button class="btn" onclick="exportarBackupSeguro()"><i class="fas fa-download"></i> BAIXAR BACKUP SEGURO</button>
            </div>
            <div class="stat-card backup-card">
                <div class="backup-icon"><i class="fas fa-file-import"></i></div>
                <h3>Restaurar backup</h3>
                <p class="meta-sub">Escolha o arquivo salvo e informe a mesma senha usada na exportacao.</p>
                <label for="restore-file">Arquivo de backup</label>
                <input type="file" id="restore-file" accept=".json,application/json">
                <label for="restore-pass">Senha do backup</label>
                <input type="password" id="restore-pass" placeholder="Senha usada no backup">
                <button class="btn btn-outline" onclick="restaurarBackupSeguro()"><i class="fas fa-upload"></i> RESTAURAR DADOS</button>
            </div>
            <div class="stat-card backup-summary">
                <h3>Dados protegidos</h3>
                <div class="backup-stats">
                    <div><small>Assuntos</small><strong>${totalAssuntos}</strong></div>
                    <div><small>Lançamentos</small><strong>${totalLancamentos}</strong></div>
                    <div><small>Último backup</small><strong>${ultimaCopia}</strong></div>
                </div>
            </div>
        </div>`;
}

function bytesToBase64(bytes) {
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
}

function base64ToBytes(base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for(let i=0; i<bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function gerarChaveBackup(senha, salt) {
    const baseKey = await crypto.subtle.importKey('raw', textEncoder.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function exportarBackupSeguro() {
    try {
        if(!crypto?.subtle) return showToast('Criptografia indisponível', 'Abra o site no Chrome ou Edge atualizado para usar backup seguro.');
        const pass = document.getElementById('backup-pass').value;
        if(!pass || pass.length < 6) return showToast('Senha curta', 'Use pelo menos 6 caracteres para proteger o backup.');

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await gerarChaveBackup(pass, salt);
        const payload = {
            app: 'plantao-policia',
            version: 1,
            exportedAt: new Date().toISOString(),
            data: db
        };
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(JSON.stringify(payload)));
        const backup = {
            app: 'plantao-policia',
            type: 'encrypted-backup',
            version: 1,
            kdf: 'PBKDF2-SHA256',
            iterations: 180000,
            salt: bytesToBase64(salt),
            iv: bytesToBase64(iv),
            data: bytesToBase64(new Uint8Array(encrypted))
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-plantao-policia-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        db.ultimoBackup = new Date().toISOString();
        save();
        renderBackup();
        showToast('Backup criado', 'Arquivo criptografado baixado com sucesso.');
    } catch(e) {
        showToast('Erro no backup', 'Não foi possível gerar o arquivo seguro.');
    }
}

async function restaurarBackupSeguro() {
    try {
        if(!crypto?.subtle) return showToast('Criptografia indisponível', 'Abra o site no Chrome ou Edge atualizado para restaurar backup seguro.');
        const file = document.getElementById('restore-file').files[0];
        const pass = document.getElementById('restore-pass').value;
        if(!file) return showToast('Selecione o arquivo', 'Escolha o backup criptografado para restaurar.');
        if(!pass) return showToast('Informe a senha', 'Digite a senha usada ao criar o backup.');

        const raw = await file.text();
        const backup = JSON.parse(raw);
        if(backup.type !== 'encrypted-backup' || !backup.salt || !backup.iv || !backup.data) {
            return showToast('Arquivo inválido', 'Este arquivo não parece ser um backup seguro do sistema.');
        }

        const key = await gerarChaveBackup(pass, base64ToBytes(backup.salt));
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64ToBytes(backup.iv) },
            key,
            base64ToBytes(backup.data)
        );
        const payload = JSON.parse(textDecoder.decode(decrypted));
        if(payload.app !== 'plantao-policia' || !payload.data) {
            return showToast('Backup inválido', 'O conteúdo restaurado não pertence a este sistema.');
        }

        db = payload.data;
        save();
        normalizarBanco();
        showToast('Backup restaurado', 'Seus dados foram recuperados com sucesso.');
        init();
        renderBackup();
    } catch(e) {
        showToast('Falha ao restaurar', 'Senha incorreta ou arquivo corrompido.');
    }
}

function completarDiaReal(diaKey, date) {
    const limite = parseFloat(db.h[date.getDay()]) || 0;
    const tasks = db.metaFixa[diaKey] || [];
    compactarTarefas(tasks);
    let total = tarefasPlanejadas(tasks).reduce((acc, t) => acc + (parseFloat(t.h) || 0), 0);
    if(total >= limite - 0.01) return;

    const simDb = JSON.parse(JSON.stringify(db));
    const simTasks = JSON.parse(JSON.stringify(tarefasPlanejadas(tasks)));
    simTasks.forEach(t => concluirTaskSim(t, diaKey, simDb));

    let safety = 0;
    while(total < limite - 0.01 && safety < 20) {
        safety++;
        const restante = limite - total;
        const extras = getNeuralPoolSim(restante, simDb, date);
        if(!extras.length) break;
        extras.forEach(extra => {
            if(total + extra.h > limite + 0.01) return;
            const existente = tasks.find(t => t.itemId === extra.itemId && t.k === extra.k && (extra.k === 'E' || extra.k === 'Rev'));
            if(existente) {
                existente.h = (parseFloat(existente.h) || 0) + extra.h;
                total += extra.h;
            } else if(!tasks.some(t => t.itemId === extra.itemId && t.k === extra.k)) {
                tasks.push(extra);
                total += extra.h;
            }
        });
    }

    db.metaFixa[diaKey] = tasks;
}

function garantirDiaPlanejado(diaKey, date) {
    if(diaPausado(diaKey)) {
        db.metaFixa[diaKey] = [];
        save();
        return;
    }
    const existentes = db.metaFixa[diaKey] || [];
    const extras = existentes.filter(isExtraTask);
    const concluidas = tarefasPlanejadas(existentes).filter(t => t.c);
    const semana = calcularSemanaPlanejada();
    const planejadasBase = semana[diaKey] || getNeuralPoolSim(parseFloat(db.h[date.getDay()]), JSON.parse(JSON.stringify(db)), date);
    const planejadas = planejadasBase.map(t => {
        const feita = concluidas.find(c => c.itemId === t.itemId && c.k === t.k);
        return feita ? {...t, c: true, perf: feita.perf} : t;
    });
    const concluidasPreservadas = concluidas.filter(c => {
        return !planejadas.some(t => t.itemId === c.itemId && t.k === c.k);
    });
    const limite = parseFloat(db.h[date.getDay()]) || 0;
    db.metaFixa[diaKey] = [...limitarTarefasAoLimite([...concluidasPreservadas, ...planejadas], limite), ...extras];
    save();
}

function calcularSemanaPlanejada() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const simDb = JSON.parse(JSON.stringify(db));
    const planejados = {};

    for(let off=0; off<7; off++) {
        const d = addDays(inicioSemana, off);
        const k = dateKey(d);
        const ehPassado = d < hoje;
        let tasks;

        if(diaPausado(k)) {
            tasks = [];
        } else if(ehPassado) {
            tasks = tarefasPlanejadas(db.metaFixa[k]).map(t => ({...t}));
        } else {
            const limiteDia = parseFloat(simDb.h[d.getDay()]) || 0;
            tasks = getNeuralPoolSim(limiteDia, simDb, d);
        }

        planejados[k] = tasks;
    }

    return planejados;
}

function compactarTarefas(tasks) {
    const vistos = new Map();
    for(let i=tasks.length - 1; i>=0; i--) {
        const t = tasks[i];
        if(isExtraTask(t)) continue;
        const chave = `${t.itemId || t.m}-${t.k}`;
        if(vistos.has(chave)) {
            const alvo = vistos.get(chave);
            if(t.k === 'E' || t.k === 'Rev') alvo.h = (parseFloat(alvo.h) || 0) + (parseFloat(t.h) || 0);
            tasks.splice(i, 1);
        } else {
            vistos.set(chave, t);
        }
    }
}

function limitarTarefasAoLimite(tasks, limite) {
    if(!Array.isArray(tasks) || limite <= 0) return [];
    const ajustadas = [];
    let total = 0;
    tasks.forEach(task => {
        if(isExtraTask(task)) {
            ajustadas.push(task);
            return;
        }
        const horas = parseFloat(task.h) || 0;
        const restante = Math.max(0, limite - total);
        if(restante <= 0.01) return;
        const horasAjustadas = task.k === 'E' ? Math.min(horas, MAX_ESTUDO_DIA) : horas;
        if(horasAjustadas <= restante + 0.01) {
            ajustadas.push({...task, h: Math.round(horasAjustadas * 10) / 10});
            total += horasAjustadas;
            return;
        }
        if(task.k === 'E' && restante >= 0.5) {
            const bloco = Math.min(restante, MAX_ESTUDO_DIA);
            ajustadas.push({...task, h: Math.round(bloco * 10) / 10});
            total += bloco;
        }
    });
    return ajustadas;
}

function renderSemanal() {
    const dN = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const hojeKey = dateKey(hoje);
    garantirDiaPlanejado(hojeKey, hoje);

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const dias = Array.from({ length: 7 }, (_, i) => i);
    const semana = calcularSemanaPlanejada();

    document.getElementById('grid-semanal').innerHTML = dias.map(off => {
        const d = addDays(inicioSemana, off);
        const k = dateKey(d);
        const ehHoje = k === hojeKey;
        let tasks = ehHoje ? tarefasPlanejadas(db.metaFixa[k]) : (semana[k] || []);

        const totalHoras = tasks.reduce((acc, t) => acc + (parseFloat(t.h) || 0), 0);
        const conteudoDia = tasks.length ? tasks.map(x => `
                    <div class="sim-task ${x.c ? 'done' : ''} tag-${x.k==='Ex'?'ex':(x.k==='Rev'?'rev':'e')}">
                        <strong>${x.m}</strong><br><span>${x.a}</span><br><em>${x.l} - ${(parseFloat(x.h) || 0).toFixed(1)}h</em>
                    </div>`).join('') : `<div class="sim-empty">${diaPausado(k) ? 'Dia pausado' : 'Sem atividades'}</div>`;
        return `
            <div class="day-column">
                <div class="day-head">${dN[d.getDay()]}<br>${k.slice(0,5)}<small>${totalHoras.toFixed(1)}h / ${db.h[d.getDay()]}h</small></div>
                ${conteudoDia}
            </div>`;
    }).join('');
}

function montarCicloPonderadoSim(state) {
    const materiasAtivas = state.ciclo.filter(m => state.lista.some(x => x.m === m));
    const maxPeso = materiasAtivas.reduce((max, m) => {
        const item = state.lista.find(x => x.m === m);
        return Math.max(max, limitarPeso(item?.peso));
    }, 1);
    const fila = [];
    for(let rodada=0; rodada<maxPeso; rodada++) {
        materiasAtivas.forEach(m => {
            const item = state.lista.find(x => x.m === m);
            if(limitarPeso(item?.peso) > rodada) fila.push(m);
        });
    }
    return fila;
}

function getNeuralPoolSim(limit, state, date) {
    return planejarDia(state, date, limit, true);
}

function concluirTaskNoState(t, dK, state) {
    const item = state.lista.find(x => x.id === t.itemId);
    if(!item) return;
    t.c = true;
    if(t.k === 'E') {
        item.hF = Math.min(item.h.E, (item.hF || 0) + t.h);
        if(item.hF >= item.h.E - 0.01) {
            item.done.E = true;
            item.lastInitialStudyDate = dK;
        }
    }
    if(t.k === 'Rev' && !item.f) {
        if((item.hF || 0) < item.h.E - 0.01) return;
        item.done.Rev = true;
        item.lastInitialRevDate = dK;
    }
    if(t.k === 'Ex' && !item.f) {
        if(!item.done.Rev) return;
        item.done.Ex = true;
        item.f = true;
        item.sinalizado = true;
        item.cicloConcluidoManual = true;
        item.hF = item.h.E;
        item.maintDone = false;
        item.revCycle = { cycle: 1, stage: 'Rev', due: dateKey(addDays(keyToDate(dK), 1)) };
    } else if(t.k === 'Rev' && item.f && item.revCycle) {
        item.revCycle.stage = 'Ex';
        item.revCycle.due = dateKey(addDays(keyToDate(dK), 1));
    } else if(t.k === 'Ex' && item.f && item.revCycle) {
        if(item.revCycle.stage !== 'Ex') return;
        const cycle = item.revCycle.cycle || 1;
        if(cycle >= 4) {
            item.revCycle = null;
            item.maintDone = true;
            reiniciarMateriaSeCompleta(state, item.m, dK);
        } else {
            item.revCycle = { cycle: cycle + 1, stage: 'Rev', due: dateKey(addDays(keyToDate(dK), revisoesIntervalos[cycle - 1])) };
        }
    }
}

function concluirTaskSim(t, dK, state) {
    concluirTaskNoState(t, dK, state);
}

function reiniciarMateriaSeCompleta(state, materia, dK) {
    const itens = state.lista.filter(x => x.m === materia);
    if(!itens.length || !itens.every(x => x.f && x.maintDone)) return;
    itens.forEach(item => {
        item.maintDone = false;
        item.revCycle = { cycle: 1, stage: 'Rev', due: dateKey(addDays(keyToDate(dK), 1)) };
    });
}

function montarCicloPonderado() {
    const materiasAtivas = db.ciclo.filter(m => db.lista.some(x => x.m === m));
    const maxPeso = materiasAtivas.reduce((max, m) => {
        const item = db.lista.find(x => x.m === m);
        return Math.max(max, limitarPeso(item?.peso));
    }, 1);
    const fila = [];
    for(let rodada=0; rodada<maxPeso; rodada++) {
        materiasAtivas.forEach(m => {
            const item = db.lista.find(x => x.m === m);
            if(limitarPeso(item?.peso) > rodada) fila.push(m);
        });
    }
    return fila;
}

function criarTask(item, tipo, horas, dataKey) {
    const labels = { E: 'Estudo', Rev: 'Revisão', Ex: 'Exercícios' };
    const ciclo = item.f && item.revCycle ? ` - Ciclo ${String(item.revCycle.cycle || 1).padStart(2, '0')}` : '';
    return { itemId: item.id, m: item.m, a: item.a, l: `${labels[tipo]}${ciclo}`, k: tipo, h: horas, c: false, data: dataKey };
}

function planejarDia(state, date, limit, mutarEstado) {
    const curKey = dateKey(date);
    const prevKey = dateKey(addDays(date, -1));
    const cicloPonderado = montarCicloPonderadoSim(state);
    const pool = [];
    let somaH = 0;
    if(!cicloPonderado.length || limit <= 0) return pool;

    const restanteDia = () => Math.max(0, limit - somaH);
    const materiaJaUsada = materia => pool.some(t => t.m === materia);
    const estudoDoAssuntoHoje = item => pool
        .filter(t => t.itemId === item.id && t.k === 'E')
        .reduce((acc, t) => acc + (parseFloat(t.h) || 0), 0);
    const estudoCompleto = item => (item.hF || 0) >= item.h.E - 0.01;
    const adicionar = (item, tipo, horas) => {
        const limiteEstudo = tipo === 'E' ? Math.max(0, MAX_ESTUDO_DIA - estudoDoAssuntoHoje(item)) : Infinity;
        let h = Math.min(horas, restanteDia(), limiteEstudo);
        if(!item || h <= 0.01) return false;
        if(materiaJaUsada(item.m)) return false;
        if((tipo === 'Rev' || tipo === 'Ex') && restanteDia() < 1) return false;
        if(tipo === 'Rev' && !item.f && !estudoCompleto(item)) return false;
        if(tipo === 'Ex' && !item.f && (!item.done.Rev || !item.lastInitialRevDate || item.lastInitialRevDate === curKey)) return false;
        if(tipo === 'Ex' && item.f && item.revCycle?.stage !== 'Ex') return false;
        if(tipo !== 'E' && pool.some(t => t.itemId === item.id && t.k === tipo)) return false;
        if(tipo === 'E' && item.hF >= item.h.E - 0.01) return false;
        const existente = pool.find(t => t.itemId === item.id && t.k === tipo && (tipo === 'E' || tipo === 'Rev'));
        const task = criarTask(item, tipo, h, curKey);
        if(existente) {
            existente.h += h;
        } else {
            pool.push(task);
        }
        somaH += h;
        if(mutarEstado) concluirTaskNoState({...task}, curKey, state);
        return true;
    };

    const adicionarSemRegraMateria = (item, tipo, horas) => {
        const limiteEstudo = tipo === 'E' ? Math.max(0, MAX_ESTUDO_DIA - estudoDoAssuntoHoje(item)) : Infinity;
        let h = Math.min(horas, restanteDia(), limiteEstudo);
        if(!item || h <= 0.01) return false;
        if((tipo === 'Rev' || tipo === 'Ex') && restanteDia() < 1) return false;
        if(tipo === 'Rev' && !item.f && !estudoCompleto(item)) return false;
        if(tipo === 'Ex' && !item.f && (!item.done.Rev || !item.lastInitialRevDate || item.lastInitialRevDate === curKey)) return false;
        if(tipo === 'Ex' && item.f && item.revCycle?.stage !== 'Ex') return false;
        if(tipo !== 'E' && pool.some(t => t.itemId === item.id && t.k === tipo)) return false;
        if(tipo === 'E' && item.hF >= item.h.E - 0.01) return false;
        const existente = pool.find(t => t.itemId === item.id && t.k === tipo && (tipo === 'E' || tipo === 'Rev'));
        const task = criarTask(item, tipo, h, curKey);
        if(existente) {
            existente.h += h;
        } else {
            pool.push(task);
        }
        somaH += h;
        if(mutarEstado) concluirTaskNoState({...task}, curKey, state);
        return true;
    };

    const candidatos = (materia, callback) => state.lista
        .filter(x => x.m === materia && assuntoPodeEntrarNoCicloInicial(state, x) && callback(x))
        .sort((a, b) => {
            const stageRank = item => {
                if(!item.f && item.done.Rev && !item.done.Ex && item.lastInitialRevDate && item.lastInitialRevDate !== curKey) return 0;
                if(item.f && item.revCycle?.stage === 'Ex' && isDue(item.revCycle.due, curKey)) return 0;
                if(!item.f && estudoCompleto(item) && !item.done.Rev && item.lastInitialStudyDate !== curKey) return 1;
                if(item.f && item.revCycle?.stage === 'Rev') return 1;
                return 2;
            };
            const ra = stageRank(a);
            const rb = stageRank(b);
            if(ra !== rb) return ra - rb;
            const ca = a.revCycle?.cycle || 0;
            const cb = b.revCycle?.cycle || 0;
            if(ca !== cb) return ca - cb;
            return (a.ordem || 0) - (b.ordem || 0);
        });

    const existeExercicioPendente = () => cicloPonderado.some(materia => {
        if(materiaJaUsada(materia)) return false;
        return candidatos(materia, x => {
            const exInicial = !x.f && x.done.Rev && !x.done.Ex && x.lastInitialRevDate && x.lastInitialRevDate !== curKey;
            const exCiclo = x.f && x.revCycle && x.revCycle.stage === 'Ex' && isDue(x.revCycle.due, curKey);
            return exInicial || exCiclo;
        }).length > 0;
    });

    const existeRevisaoDisponivel = () => cicloPonderado.some(materia => {
        if(materiaJaUsada(materia)) return false;
        return candidatos(materia, x => {
            const revisaoInicial = !x.f && estudoCompleto(x) && !x.done.Rev && x.lastInitialStudyDate !== curKey;
            const revisaoCiclo = x.f && x.revCycle && x.revCycle.stage === 'Rev';
            return revisaoInicial || revisaoCiclo;
        }).length > 0;
    });

    const temTeoriaPendenteAtiva = item => {
        return !item.f && !estudoCompleto(item) && Math.max(0, item.h.E - (item.hF || 0)) > 0.01;
    };

    const deveFocarTeoriaPendente = item => {
        if(!temTeoriaPendenteAtiva(item)) return false;
        return !item.lastInitialStudyDate || item.lastInitialStudyDate !== prevKey;
    };

    const visitar = callback => {
        let added = false;
        const materiasVisitadas = new Set();
        for(const materia of cicloPonderado) {
            if(restanteDia() <= 0.01) break;
            if(materiasVisitadas.has(materia)) continue;
            materiasVisitadas.add(materia);
            const item = candidatos(materia, callback).find(x => !materiaJaUsada(x.m) && !pool.some(t => t.itemId === x.id && t.k === (x.f && x.revCycle ? x.revCycle.stage : (!estudoCompleto(x) ? 'E' : (!x.done.Rev ? 'Rev' : 'Ex')))));
            if(!item) continue;
            if(item.f && item.revCycle && isDue(item.revCycle.due, curKey)) {
                added = adicionar(item, item.revCycle.stage, 1) || added;
            } else if(!item.f && !estudoCompleto(item)) {
                const restante = Math.max(0, item.h.E - (item.hF || 0));
                added = adicionar(item, 'E', restante) || added;
            } else if(!item.f && estudoCompleto(item) && !item.done.Rev && item.lastInitialStudyDate !== curKey) {
                added = adicionar(item, 'Rev', 1) || added;
            } else if(!item.f && item.done.Rev && !item.done.Ex && item.lastInitialRevDate !== curKey) {
                added = adicionar(item, 'Ex', 1) || added;
            }
        }
        return added;
    };

    const encaixarExerciciosObrigatorios = () => {
        let added = false;
        const materiasVisitadas = new Set();
        for(const materia of cicloPonderado) {
            if(restanteDia() < 1) break;
            if(materiasVisitadas.has(materia)) continue;
            materiasVisitadas.add(materia);

            const exercicioInicial = state.lista
                .filter(x => x.m === materia && !x.f && x.done.Rev && !x.done.Ex && x.lastInitialRevDate && x.lastInitialRevDate !== curKey)
                .sort((a, b) => {
                    const aOntem = a.lastInitialRevDate === prevKey ? 0 : 1;
                    const bOntem = b.lastInitialRevDate === prevKey ? 0 : 1;
                    if(aOntem !== bOntem) return aOntem - bOntem;
                    return (a.ordem || 0) - (b.ordem || 0);
                })[0];
            if(exercicioInicial) {
                added = adicionar(exercicioInicial, 'Ex', 1) || added;
                continue;
            }

            const exercicioCiclo = state.lista
                .filter(x => x.m === materia && x.f && x.revCycle && x.revCycle.stage === 'Ex' && isDue(x.revCycle.due, curKey))
                .sort((a, b) => {
                    const aOntem = a.revCycle?.due === prevKey ? 0 : 1;
                    const bOntem = b.revCycle?.due === prevKey ? 0 : 1;
                    if(aOntem !== bOntem) return aOntem - bOntem;
                    return (a.ordem || 0) - (b.ordem || 0);
                })[0];
            if(exercicioCiclo) added = adicionar(exercicioCiclo, 'Ex', 1) || added;
        }
        return added;
    };

    const encaixarTeoriasPendentes = preferirIntervalo => {
        let added = false;
        const materiasVisitadas = new Set();
        for(const materia of cicloPonderado) {
            if(restanteDia() <= 0.01) break;
            if(materiasVisitadas.has(materia) || materiaJaUsada(materia)) continue;
            materiasVisitadas.add(materia);

            const teoria = candidatos(materia, x => {
                if(!temTeoriaPendenteAtiva(x)) return false;
                return !preferirIntervalo || deveFocarTeoriaPendente(x);
            })[0];
            if(teoria) added = adicionar(teoria, 'E', Math.max(0, teoria.h.E - (teoria.hF || 0))) || added;
        }
        return added;
    };

    const encaixarRevisoes = permitirAdiantadas => {
        if(existeExercicioPendente()) return false;
        let added = false;
        const materiasVisitadas = new Set();
        for(const materia of cicloPonderado) {
            if(restanteDia() < 1) break;
            if(materiasVisitadas.has(materia) || materiaJaUsada(materia)) continue;
            materiasVisitadas.add(materia);

            const revisaoInicial = candidatos(materia, x => !x.f && estudoCompleto(x) && !x.done.Rev && x.lastInitialStudyDate !== curKey)[0];
            if(revisaoInicial) {
                added = adicionar(revisaoInicial, 'Rev', 1) || added;
                continue;
            }

            const revisaoCiclo = candidatos(materia, x => x.f && x.revCycle && x.revCycle.stage === 'Rev' && (permitirAdiantadas || isDue(x.revCycle.due, curKey)))[0];
            if(revisaoCiclo) added = adicionar(revisaoCiclo, 'Rev', 1) || added;
        }
        return added;
    };

    while(restanteDia() >= 1 && encaixarExerciciosObrigatorios()) {}
    encaixarTeoriasPendentes(true);
    encaixarRevisoes(false);

    let safety = 0;
    while(restanteDia() > 0.01 && safety < 80) {
        safety++;
        const added = visitar(x => !x.f && ((temTeoriaPendenteAtiva(x) && deveFocarTeoriaPendente(x)) || (estudoCompleto(x) && !x.done.Rev && x.lastInitialStudyDate !== curKey) || (x.done.Rev && !x.done.Ex && x.lastInitialRevDate !== curKey)));
        if(!added) break;
    }

    if(pool.length && pool.every(t => t.k === 'E') && restanteDia() >= 1 && !existeExercicioPendente()) encaixarRevisoes(true);

    let dueSafety = 0;
    while(restanteDia() > 0.01 && dueSafety < 80) {
        dueSafety++;
        const addedDue = visitar(x => x.f && x.revCycle && isDue(x.revCycle.due, curKey));
        if(!addedDue) break;
    }

    safety = 0;
    while(restanteDia() > 0.01 && safety < 80) {
        safety++;
        let added = false;
        const materiasVisitadas = new Set();
        for(const materia of cicloPonderado) {
            if(restanteDia() <= 0.01) break;
            if(materiasVisitadas.has(materia)) continue;
            materiasVisitadas.add(materia);
            if(materiaJaUsada(materia)) continue;
            const exercicio = candidatos(materia, x => !x.f && x.done.Rev && !x.done.Ex && x.lastInitialRevDate && x.lastInitialRevDate !== curKey)[0];
            if(exercicio) {
                added = adicionar(exercicio, 'Ex', 1) || added;
                continue;
            }
            const manutencaoEx = candidatos(materia, x => x.f && x.revCycle && x.revCycle.stage === 'Ex' && isDue(x.revCycle.due, curKey))[0];
            if(manutencaoEx) {
                added = adicionar(manutencaoEx, 'Ex', 1) || added;
                continue;
            }
            const teoria = candidatos(materia, x => temTeoriaPendenteAtiva(x) && deveFocarTeoriaPendente(x))[0];
            if(teoria) {
                added = adicionar(teoria, 'E', Math.max(0, teoria.h.E - (teoria.hF || 0))) || added;
                continue;
            }
            const manutencao = candidatos(materia, x => x.f && x.revCycle && isDue(x.revCycle.due, curKey))[0];
            if(manutencao) added = adicionar(manutencao, manutencao.revCycle.stage, 1) || added;
            if(added) continue;
            const revisao = candidatos(materia, x => !x.f && estudoCompleto(x) && !x.done.Rev)[0];
            if(revisao) added = adicionar(revisao, 'Rev', 1) || added;
        }
        if(!added) break;
    }

    let fillSafety = 0;
    while(restanteDia() > 0.01 && fillSafety < 80) {
        fillSafety++;
        let added = false;
        const materiasVisitadas = new Set();
        for(const materia of cicloPonderado) {
            if(restanteDia() <= 0.01) break;
            if(materiasVisitadas.has(materia) || materiaJaUsada(materia)) continue;
            materiasVisitadas.add(materia);
            const teoria = candidatos(materia, x => temTeoriaPendenteAtiva(x) && deveFocarTeoriaPendente(x))[0];
            if(teoria) { added = adicionarSemRegraMateria(teoria, 'E', Math.max(0, teoria.h.E - (teoria.hF || 0))) || added; continue; }
            const exercicio = candidatos(materia, x => !x.f && x.done.Rev && !x.done.Ex && x.lastInitialRevDate && x.lastInitialRevDate !== curKey)[0];
            if(exercicio) { added = adicionarSemRegraMateria(exercicio, 'Ex', 1) || added; continue; }
            const manutencao = candidatos(materia, x => x.f && x.revCycle && isDue(x.revCycle.due, curKey))[0];
            if(manutencao) added = adicionarSemRegraMateria(manutencao, manutencao.revCycle.stage, 1) || added;
            if(added) continue;
            const revisao = candidatos(materia, x => !x.f && estudoCompleto(x) && !x.done.Rev && x.lastInitialStudyDate !== curKey)[0];
            if(revisao) { added = adicionarSemRegraMateria(revisao, 'Rev', 1) || added; continue; }
        }
        if(!added) break;
    }

    let ultimaTentativa = 0;
    while(restanteDia() > 0.01 && ultimaTentativa < 80) {
        ultimaTentativa++;
        let added = false;
        const materiasVisitadas = new Set();
        for(const materia of cicloPonderado) {
            if(restanteDia() <= 0.01) break;
            if(materiasVisitadas.has(materia)) continue;
            materiasVisitadas.add(materia);
            const teoria = candidatos(materia, x => !x.f && !estudoCompleto(x) && Math.max(0, x.h.E - (x.hF || 0)) > 0.01)[0];
            if(teoria) { added = adicionarSemRegraMateria(teoria, 'E', Math.max(0, teoria.h.E - (teoria.hF || 0))) || added; continue; }
            const exercicio = candidatos(materia, x => !x.f && x.done.Rev && !x.done.Ex && x.lastInitialRevDate && x.lastInitialRevDate !== curKey)[0];
            if(exercicio) { added = adicionarSemRegraMateria(exercicio, 'Ex', 1) || added; continue; }
            const manutencao = candidatos(materia, x => x.f && x.revCycle)[0];
            if(manutencao) added = adicionarSemRegraMateria(manutencao, manutencao.revCycle.stage, 1) || added;
            if(added) continue;
            const revisao = candidatos(materia, x => !x.f && estudoCompleto(x) && !x.done.Rev && x.lastInitialStudyDate !== curKey)[0];
            if(revisao) { added = adicionarSemRegraMateria(revisao, 'Rev', 1) || added; continue; }
        }
        if(!added) break;
    }

    return limitarTarefasAoLimite(pool, limit);
}

function assuntoPodeEntrarNoCicloInicial(state, item) {
    const inicialPendenteNaMateria = state.lista
        .some(x => x.m === item.m && !x.f);
    if(item.f) return !inicialPendenteNaMateria;
    const primeiroPendente = state.lista
        .filter(x => x.m === item.m && !x.f)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))[0];
    return primeiroPendente?.id === item.id;
}

function getNeuralPool(limit, simList, date = vDate) {
    const simState = JSON.parse(JSON.stringify(db));
    return planejarDia(simState, date, limit, true);
}

function impEdital() {
    const matEl = document.getElementById('add-mat');
    const assEl = document.getElementById('add-ass');
    const horasEl = document.getElementById('add-horas');
    const pesoEl = document.getElementById('add-peso');
    const m = matEl.value.trim().toUpperCase();
    const txt = assEl.value.trim();
    const horas = Math.max(0.5, parseFloat(horasEl.value) || 1.5);
    const peso = limitarPeso(pesoEl.value);
    pesoEl.value = peso;
    if(!m || !txt) {
        showToast("Preencha a matéria", "Informe a matéria e pelo menos um assunto.");
        return;
    }

    const assuntos = txt.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    assuntos.forEach((a, idx) => {
        db.lista.push({
            id: `${safeId(m)}-${safeId(a)}-${Date.now()}-${idx}`,
            ordem: db.lista.length + idx,
            m,
            a,
            peso,
            h: {E:horas, Rev:1, Ex:1},
            f: false,
            done: {E:false, Rev:false, Ex:false},
            hF: 0,
            sinalizado: false,
            maintDone: false,
            revCycle: null
        });
    });
    db.metaFixa = {};
    save();
    matEl.value = '';
    assEl.value = '';
    horasEl.value = '1.5';
    pesoEl.value = '1';
    showToast("Matéria salva", `${m} entrou no edital com ${assuntos.length} assunto(s).`);
}

function renderTree() {
    const mats = [...new Set(db.lista.map(x => x.m))];
    const totalAssuntos = db.lista.length;
    const totalSinalizados = db.lista.filter(x => x.sinalizado).length;
    const totalPendentes = totalAssuntos - totalSinalizados;
    const percGeral = totalAssuntos ? Math.round((totalSinalizados / totalAssuntos) * 100) : 0;
    const resumo = `
        <div class="base-summary">
            <div class="base-summary-card">
                <small>Total de assuntos</small>
                <strong>${totalAssuntos}</strong>
            </div>
            <div class="base-summary-card">
                <small>Sinalizados</small>
                <strong>${totalSinalizados}</strong>
            </div>
            <div class="base-summary-card">
                <small>No ciclo inicial</small>
                <strong>${totalPendentes}</strong>
            </div>
            <div class="base-summary-card accent">
                <small>Base dominada</small>
                <strong>${percGeral}%</strong>
            </div>
        </div>`;
    const materiasHtml = mats.map(m => {
        const itens = db.lista.map((a, idx) => ({...a, idx})).filter(x => x.m === m);
        const sinalizados = itens.filter(x => x.sinalizado).length;
        const pendentes = itens.length - sinalizados;
        const perc = itens.length ? Math.round((sinalizados / itens.length) * 100) : 0;
        return `
        <div class="folder base-folder">
            <div class="folder-header" onclick="this.parentElement.querySelector('.folder-content').classList.toggle('open')">
                <div class="folder-title">
                    <b>${m}</b>
                    <small>${itens.length} assunto(s) | ${pendentes} no ciclo inicial</small>
                </div>
                <div class="folder-progress">
                    <span>${perc}%</span>
                    <div class="mini-bar"><div style="width:${perc}%"></div></div>
                </div>
            </div>
            <div class="folder-actions">
                <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); sinalizarMateria('${encodeURIComponent(m)}', true)">SELECIONAR TODOS</button>
                <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); sinalizarMateria('${encodeURIComponent(m)}', false)">LIMPAR</button>
            </div>
            <div class="folder-content">
                ${itens.map(a => `
                    <div class="sinal-row ${a.sinalizado ? 'done' : ''}">
                        <div class="sinal-info">
                            <span>${a.a}</span>
                            <small>${a.sinalizado ? 'Sinalizado como estudado' : 'Entrará no ciclo inicial'}</small>
                        </div>
                        <label class="cycle-toggle" title="Sinalizar assunto">
                            <input type="checkbox" ${a.sinalizado?'checked':''} onchange="sinalizarAssunto(${a.idx}, this.checked)">
                            <span></span>
                        </label>
                    </div>`).join('')}
            </div>
        </div>`;
    }).join('');
    document.getElementById('tree').innerHTML = resumo + materiasHtml;
    renderReverSinalizados();
}

function renderReverSinalizados() {
    const alvo = document.getElementById('rever-sinalizados');
    if(!alvo) return;
    const sinalizados = db.lista
        .map((item, idx) => ({...item, idx}))
        .filter(item => item.sinalizado)
        .sort((a, b) => a.m.localeCompare(b.m) || (a.ordem || 0) - (b.ordem || 0));

    const porMateria = sinalizados.reduce((acc, item) => {
        acc[item.m] = (acc[item.m] || 0) + 1;
        return acc;
    }, {});

    alvo.innerHTML = `
        <div class="review-panel">
            <div class="review-header">
                <div>
                    <h3>Rever assuntos sinalizados</h3>
                    <p>Ative novamente um assunto para ele voltar ao ciclo inicial.</p>
                </div>
                <span>${sinalizados.length} assunto(s)</span>
            </div>
            ${sinalizados.length ? `
                <div class="review-chips">
                    ${Object.keys(porMateria).map(m => `<span>${m}: ${porMateria[m]}</span>`).join('')}
                </div>` : ''}
            ${sinalizados.length ? sinalizados.map(item => `
                <div class="review-row">
                    <div>
                        <b>${item.m}</b>
                        <small>${item.a}</small>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="ativarAssuntoCicloInicial(${item.idx})">
                        <i class="fas fa-rotate-left"></i> ATIVAR CICLO INICIAL
                    </button>
                </div>`).join('') : `
                <div class="empty-state">
                    <i class="fas fa-book-open"></i>
                    <strong>Nenhum assunto sinalizado</strong>
                    <span>Os assuntos marcados como estudados aparecerão aqui.</span>
                </div>`}
        </div>`;
}

function renderFluxo() {
    const mats = [...new Set(db.lista.map(x => x.m))];
    document.getElementById('fluxo-content').innerHTML = mats.map(m => {
        const item = db.lista.find(x => x.m === m);
        const assuntos = db.lista.map((x, idx) => ({...x, idx})).filter(x => x.m === m);
        return `
            <div class="stat-card flow-card collapsed">
                <div class="flow-row flow-toggle-head" onclick="toggleFluxoBox(this)">
                    <div class="flow-info">
                        <b>${m}</b>
                        <small style="display:block; color:var(--text-sec); margin-top:4px;">${assuntos.length} assunto(s) | peso ${item.peso}x | ${item.h.E}h padrão</small>
                    </div>
                    <button type="button" class="flow-expand-btn" onclick="event.stopPropagation(); toggleFluxoBox(this.closest('.flow-toggle-head'))">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <div class="flow-body">
                    <div class="flow-row flow-row-inner">
                        <div class="flow-info">
                            <b>Ajuste geral</b>
                            <small style="display:block; color:var(--text-sec); margin-top:4px;">O peso vale para todos os assuntos desta matéria.</small>
                        </div>
                    <div class="flow-grid">
                        <div>
                            <label>Horas de estudo da matéria</label>
                            <input type="number" id="fluxo-h-${safeId(m)}" min="0.5" step="0.5" value="${item.h.E}">
                        </div>
                        <div>
                            <label>Peso no ciclo</label>
                            <input type="number" id="fluxo-p-${safeId(m)}" min="1" max="5" step="1" value="${item.peso}">
                        </div>
                    </div>
                    <button class="btn btn-sm" onclick="salvarFluxoMateria('${encodeURIComponent(m)}')">SALVAR MATÉRIA</button>
                    </div>
                    <div class="subject-flow-list">
                        <div class="subject-flow-head">
                            <span>Assuntos cadastrados</span>
                            <small>${assuntos.length} item(ns)</small>
                        </div>
                        ${assuntos.map(a => `
                            <div class="subject-flow-row">
                                <div>
                                    <b>${a.a}</b>
                                    <small>${a.sinalizado ? 'Sinalizado como estudado' : 'Ciclo inicial'}</small>
                                </div>
                                <label>
                                    Horas de estudo
                                    <input type="number" id="fluxo-assunto-${a.idx}" min="0.5" step="0.5" value="${a.h.E}">
                                </label>
                                <button class="btn btn-sm btn-outline" onclick="salvarFluxoAssunto(${a.idx})">SALVAR</button>
                            </div>`).join('')}
                    </div>
                </div>
            </div>`;
    }).join('');
}

function toggleFluxoBox(head) {
    const card = head.closest('.flow-card');
    if(card) card.classList.toggle('collapsed');
}

function renderCiclo() {
    const mats = [...new Set(db.lista.map(x => x.m))];
    document.getElementById('check-c').innerHTML = mats.map(m => {
        const item = db.lista.find(x => x.m === m);
        const total = db.lista.filter(x => x.m === m).length;
        const ativo = db.ciclo.includes(m);
        return `
            <div class="ciclo-row ${ativo ? 'active' : ''}">
                <label class="cycle-toggle" title="Ativar no ciclo">
                    <input type="checkbox" class="ckc" value="${m}" ${ativo?'checked':''}>
                    <span></span>
                </label>
                <div class="ciclo-info">
                    <b>${m}</b>
                    <small>${total} assunto(s) cadastrados</small>
                </div>
                <div class="cycle-badges">
                    <span>Peso ${item.peso}x</span>
                    <span>${ativo ? 'Ativa' : 'Fora do ciclo'}</span>
                </div>
                <div class="ciclo-actions">
                    <button class="icon-danger-btn" title="Remover matéria do site" onclick="removerMateria('${encodeURIComponent(m)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

function saveC() {
    db.ciclo = Array.from(document.querySelectorAll('.ckc:checked')).map(c => c.value);
    db.metaFixa = {};
    save();
    renderCiclo();
    updateDashboard();
    showToast("Ciclo ativado", `${db.ciclo.length} matéria(s) em giro no planejamento.`);
}

function removerMateria(materia) {
    materia = decodeURIComponent(materia);
    if(!confirm(`Remover ${materia} do site? Isso apaga os assuntos dessa matéria e refaz o planejamento.`)) return;
    db.lista = db.lista.filter(x => x.m !== materia);
    db.ciclo = db.ciclo.filter(x => x !== materia);
    Object.keys(db.metaFixa).forEach(dia => {
        db.metaFixa[dia] = db.metaFixa[dia].filter(t => t.m !== materia);
        if(!db.metaFixa[dia].length) delete db.metaFixa[dia];
    });
    save();
    renderCiclo();
    updateDashboard();
}

function renderHInputs() {
    const dN = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
    document.getElementById('grid-h-in').innerHTML = `
        <div class="hours-presets" style="grid-column:1 / -1;">
            <div>
                <label>Horas nos dias de semana</label>
                <input type="number" id="h-semana" min="0" step="0.5" value="${db.h[1] || 0}">
            </div>
            <div>
                <label>Horas no fim de semana</label>
                <input type="number" id="h-fds" min="0" step="0.5" value="${db.h[6] || 0}">
            </div>
            <button type="button" class="btn btn-outline" style="grid-column:1 / -1;" onclick="aplicarHorasGrupo()">APLICAR NAS DIÁRIAS</button>
        </div>
        ${dN.map((n,i) => `<div><small>${n}</small><br><input type="number" min="0" step="0.5" id="h-in-${i}" value="${db.h[i]}" style="width:70px;"></div>`).join('')}`;
}

function saveH() {
    for(let i=0; i<7; i++) db.h[i] = Math.max(0, parseFloat(document.getElementById(`h-in-${i}`).value) || 0);
    db.metaFixa = {};
    save();
    updateDashboard();
    showToast("Horas salvas", "A carga diária foi atualizada no planejamento.");
}

function aplicarHorasGrupo() {
    const semana = Math.max(0, parseFloat(document.getElementById('h-semana').value) || 0);
    const fds = Math.max(0, parseFloat(document.getElementById('h-fds').value) || 0);
    [1,2,3,4,5].forEach(i => document.getElementById(`h-in-${i}`).value = semana);
    [0,6].forEach(i => document.getElementById(`h-in-${i}`).value = fds);
}

function marcarComoEstudado(item, marcado) {
    item.sinalizado = marcado;
    item.cicloConcluidoManual = marcado;
    item.done = {E: marcado, Rev: marcado, Ex: marcado};
    item.f = marcado;
    item.hF = marcado ? item.h.E : 0;
    item.lastInitialRevDate = null;
    item.lastInitialStudyDate = null;
    item.maintDone = false;
    item.revCycle = marcado ? { cycle: 1, stage: 'Rev', due: dateKey(addDays(new Date(), 1)) } : null;
}

function sinalizarAssunto(idx, marcado) {
    marcarComoEstudado(db.lista[idx], marcado);
    db.metaFixa = {};
    save();
    renderTree();
    updateDashboard();
}

function ativarAssuntoCicloInicial(idx) {
    const item = db.lista[idx];
    if(!item) return;
    marcarComoEstudado(item, false);
    db.metaFixa = {};
    save();
    renderTree();
    updateDashboard();
    showToast("Assunto reativado", `${item.a} voltou para o ciclo inicial.`);
}

function sinalizarMateria(materia, marcado) {
    materia = decodeURIComponent(materia);
    db.lista.forEach(item => {
        if(item.m === materia) marcarComoEstudado(item, marcado);
    });
    db.metaFixa = {};
    save();
    renderTree();
    updateDashboard();
}

function salvarFluxoMateria(materia) {
    materia = decodeURIComponent(materia);
    const id = safeId(materia);
    const horas = Math.max(0.5, parseFloat(document.getElementById(`fluxo-h-${id}`).value) || 1.5);
    const peso = limitarPeso(document.getElementById(`fluxo-p-${id}`).value);
    db.lista.forEach(item => {
        if(item.m === materia) {
            item.h.E = horas;
            item.h.Rev = 1;
            item.h.Ex = 1;
            item.peso = peso;
        }
    });
    db.metaFixa = {};
    save();
    renderFluxo();
    updateDashboard();
    showToast("Fluxo atualizado", `${materia} agora usa ${horas}h de estudo e peso ${peso}.`);
}

function salvarFluxoAssunto(idx) {
    const item = db.lista[idx];
    if(!item) return;
    const horas = Math.max(0.5, parseFloat(document.getElementById(`fluxo-assunto-${idx}`).value) || item.h.E || 1.5);
    item.h.E = horas;
    item.h.Rev = 1;
    item.h.Ex = 1;
    if(!item.f) item.hF = Math.min(item.hF || 0, horas);
    db.metaFixa = {};
    save();
    renderFluxo();
    updateDashboard();
    showToast("Assunto atualizado", `${item.a} agora usa ${horas}h de estudo.`);
}

function atualizarProgressoCiclo() {
    const itens = db.lista.filter(x => db.ciclo.includes(x.m));
    const bar = document.getElementById('bar-ciclo-total');
    const txt = document.getElementById('perc-ciclo');
    const carro = document.getElementById('viatura-progresso');
    const estimativa = document.getElementById('ciclo-estimativa');
    if(!itens.length) {
        bar.style.width = "0%";
        if(carro) carro.style.left = "0%";
        txt.innerText = "0% cumprido";
        if(estimativa) estimativa.innerText = "";
        return;
    }

    const total = itens.reduce((acc, item) => acc + cargaTotalItem(item), 0);
    const feito = itens.reduce((acc, item) => acc + cargaFeitaItem(item), 0);
    const restante = Math.max(0, total - feito);
    const p = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0;
    const horasSemana = Object.values(db.h).reduce((acc, h) => acc + (parseFloat(h) || 0), 0);
    const diasEstimados = horasSemana > 0 ? Math.ceil((restante / horasSemana) * 7) : 0;
    const textoTempo = textoDataEdital() || (restante <= 0 ? "Edital finalizado" : `~${diasEstimados} dias restantes`);

    bar.style.width = p + "%";
    if(carro) carro.style.left = `calc(${p}% - ${p > 5 ? 18 : 0}px)`;
    txt.innerText = `${p}% cumprido | ${restante.toFixed(1)}h restantes`;
    if(estimativa) estimativa.innerText = textoTempo;
}

function cargaTotalItem(item) {
    const ciclosManutencao = 4 * 2;
    return (parseFloat(item.h.E) || 0) + 1 + 1 + ciclosManutencao;
}

function cargaFeitaItem(item) {
    let feito = Math.min(parseFloat(item.hF) || 0, parseFloat(item.h.E) || 0);
    if(item.done?.Rev) feito += 1;
    if(item.done?.Ex) feito += 1;
    if(item.f) {
        const cycle = item.revCycle?.cycle || (item.maintDone ? 5 : 1);
        const ciclosCompletos = Math.max(0, Math.min(4, cycle - 1));
        feito += ciclosCompletos * 2;
        if(item.revCycle?.stage === 'Ex') feito += 1;
        if(item.maintDone) feito += 8;
    }
    return Math.min(cargaTotalItem(item), feito);
}

function checkStreak() {
    let streak = 0;
    const d = new Date();
    while(true) {
        const k = dateKey(d);
        if(db.metaFixa[k]?.length && db.metaFixa[k].every(t => t.c)) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    document.getElementById('streak-val').innerText = streak;
}

function navDay(dir) {
    if(dir === 0) vDate = new Date();
    else {
        const am = new Date();
        am.setDate(am.getDate() + 1);
        vDate = am;
    }
    renderDiario(vDate);
}

function salvarExtra() {
    const m = document.getElementById('extra-mat').value;
    const a = document.getElementById('extra-ass').value;
    const tK = document.getElementById('extra-tipo').value;
    const tH = parseFloat(document.getElementById('extra-tempo').value);
    if(!m || !a || isNaN(tH)) return;
    const hj = dateKey(new Date());
    if(!db.metaFixa[hj]) db.metaFixa[hj] = [];
    db.metaFixa[hj].push({ m: m.toUpperCase(), a, l: "Extra", k: tK, h: tH, c: true, extra: true });
    save();
    fecharModais();
    vDate = new Date();
    renderDiario(vDate);
    updateDashboard();
}
//trigger deploy
