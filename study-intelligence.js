(function plantaoStudyIntelligence() {
    if(window.__plantaoStudyIntelligence) return;
    window.__plantaoStudyIntelligence = true;

    const VERSION = 'v212-study-intelligence';
    const WRAPPED = '__plantaoStudyIntelligenceWrapped';
    const PAGE_IDS = ['inteligencia', 'caderno-erros', 'simulados', 'busca-global', 'evolucao'];

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function setFn(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function state() {
        try { return Function('return typeof db === "undefined" ? null : db;')(); }
        catch(_) { return null; }
    }

    function saveState() {
        const save = fn('save');
        if(save) save();
        else {
            const s = state();
            if(s) localStorage.setItem('prf_v120', JSON.stringify(s));
        }
    }

    function esc(value) {
        const escapeHtml = fn('escapeHtml');
        if(escapeHtml) return escapeHtml(String(value ?? ''));
        return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    function clean(value) {
        const fix = fn('corrigirMojibakeValor');
        const text = String(value ?? '');
        return fix ? fix(text) : text;
    }

    function num(value) {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : 0;
    }

    function int(value) {
        const n = parseInt(value, 10);
        return Number.isFinite(n) ? n : 0;
    }

    function today() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function dateKeyOf(date) {
        const dateKey = fn('dateKey');
        if(dateKey) return dateKey(date);
        return date.toLocaleDateString();
    }

    function keyDate(key) {
        const keyToDate = fn('keyToDate');
        if(keyToDate) return keyToDate(key);
        const parts = String(key || '').split('/').map(Number);
        if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        return new Date(key);
    }

    function daysBetween(a, b) {
        const start = new Date(a); start.setHours(0,0,0,0);
        const end = new Date(b); end.setHours(0,0,0,0);
        return Math.round((end - start) / 86400000);
    }

    function getLaunches(source = state()) {
        const listar = fn('listarLancamentos');
        if(source === state() && listar) {
            try { return listar().filter(x => !isExtra(x.task)); } catch(_) {}
        }
        const out = [];
        Object.keys(source?.metaFixa || {}).forEach(day => {
            (source.metaFixa[day] || []).forEach((task, idx) => {
                if(task?.c && !isExtra(task)) out.push({ dia: day, idx, task });
            });
        });
        return out.sort((a, b) => keyDate(b.dia) - keyDate(a.dia));
    }

    function isExtra(task) {
        const original = fn('isExtraTask');
        if(original) return original(task);
        return task?.extra === true || task?.l === 'Extra';
    }

    function performanceData() {
        const original = fn('getPerformanceData');
        if(original) {
            try { return original(); } catch(_) {}
        }
        const launches = getLaunches();
        const byMatter = {};
        const bySubject = {};
        launches.forEach(({ task }) => {
            const matter = task.m || 'Matéria';
            const subject = task.a || 'Assunto';
            const key = `${matter}||${subject}`;
            [byMatter[matter] || (byMatter[matter] = { nome: matter, horas: 0, questoes: 0, acertos: 0, atividades: 0 }),
             bySubject[key] || (bySubject[key] = { materia: matter, assunto: subject, horas: 0, questoes: 0, acertos: 0, atividades: 0 })]
                .forEach(row => {
                    row.horas += num(task.h);
                    row.atividades += 1;
                    row.questoes += int(task.perf?.t);
                    row.acertos += int(task.perf?.a);
                });
        });
        return { lancamentos: launches, materias: Object.values(byMatter), assuntos: Object.values(bySubject) };
    }

    function rate(item) {
        const taxa = fn('taxa');
        if(taxa) {
            try { return taxa(item); } catch(_) {}
        }
        return item?.questoes ? Math.round((item.acertos / item.questoes) * 100) : 0;
    }

    function ensureData() {
        const s = state();
        if(!s) return null;
        if(!Array.isArray(s.cadernoErros)) s.cadernoErros = [];
        if(!Array.isArray(s.simulados)) s.simulados = [];
        if(!s.metasEstudo || typeof s.metasEstudo !== 'object') s.metasEstudo = {};
        if(!s.metasEstudo.questoesSemana) s.metasEstudo.questoesSemana = 150;
        if(!s.metasEstudo.horasSemana) s.metasEstudo.horasSemana = 20;
        return s;
    }

    function matterList() {
        const s = ensureData();
        return [...new Set((s?.lista || []).map(item => item.m).filter(Boolean))].sort((a, b) => clean(a).localeCompare(clean(b), 'pt-BR'));
    }

    function subjectList(matter) {
        const s = ensureData();
        return (s?.lista || [])
            .filter(item => !matter || item.m === matter)
            .map(item => item.a)
            .filter(Boolean)
            .sort((a, b) => clean(a).localeCompare(clean(b), 'pt-BR'));
    }

    function itemStatus(item) {
        const hDone = num(item.hF);
        const hNeed = num(item.h?.E || 0);
        if(!item.f && hDone < hNeed - 0.01) return { kind: 'E', label: 'Estudo', pending: Math.max(0.5, hNeed - hDone) };
        if(!item.done?.Rev) return { kind: 'Rev', label: 'Revisão', pending: num(item.h?.Rev || 1) || 1 };
        if(!item.done?.Ex) return { kind: 'Ex', label: 'Exercícios', pending: num(item.h?.Ex || 1) || 1 };
        if(item.revCycle?.stage) return { kind: item.revCycle.stage, label: item.revCycle.stage === 'Ex' ? 'Exercícios' : 'Revisão', pending: 1 };
        return { kind: 'Man', label: 'Manutenção', pending: 1 };
    }

    function lastLaunchFor(item) {
        return getLaunches().find(({ task }) => task.itemId === item.id || (task.m === item.m && task.a === item.a));
    }

    function subjectPerformance(item, perf = performanceData()) {
        return perf.assuntos.find(x => x.materia === item.m && x.assunto === item.a) || { questoes: 0, acertos: 0, horas: 0, atividades: 0 };
    }

    function isDueItem(item) {
        if(!item.revCycle?.due) return false;
        try { return keyDate(item.revCycle.due) <= today(); } catch(_) { return false; }
    }

    function smartQueue() {
        const s = ensureData();
        const perf = performanceData();
        const now = today();
        return (s?.lista || []).map((item, index) => {
            const status = itemStatus(item);
            const p = subjectPerformance(item, perf);
            const last = lastLaunchFor(item);
            const daysQuiet = last ? Math.max(0, daysBetween(keyDate(last.dia), now)) : 999;
            const precision = p.questoes ? rate(p) : null;
            const weight = Math.max(1, int(item.peso || 1));
            const due = isDueItem(item);
            const pendingCycle = !item.f || !item.done?.Rev || !item.done?.Ex || due;
            let score = 0;
            score += weight * 12;
            score += pendingCycle ? 32 : 8;
            score += due ? 35 : 0;
            score += precision === null ? 14 : Math.max(0, 75 - precision);
            score += p.questoes < 20 ? 12 : 0;
            score += Math.min(24, Math.floor(daysQuiet / 3));
            score += status.kind === 'Ex' ? 8 : 0;
            score += status.kind === 'Rev' ? 6 : 0;
            score += item.f ? 0 : 10;
            const reasons = [];
            if(due) reasons.push('revisão vencida');
            if(precision !== null && precision < 70) reasons.push(`${precision}% de acerto`);
            if(p.questoes < 20) reasons.push('poucas questões');
            if(daysQuiet > 14) reasons.push('há muitos dias sem contato');
            if(weight > 1) reasons.push(`peso ${weight}x`);
            if(!item.f) reasons.push('assunto pendente');
            return { item, index, status, score, perf: p, precision, daysQuiet, reasons };
        })
        .filter(row => row.item && (!row.item.f || !row.item.done?.Rev || !row.item.done?.Ex || row.item.revCycle || row.perf.questoes < 20 || (row.precision !== null && row.precision < 80)))
        .sort((a, b) => b.score - a.score || a.index - b.index);
    }

    function weakSubjects(limit = 8) {
        return performanceData().assuntos
            .filter(x => x.questoes > 0)
            .map(x => ({ ...x, taxa: rate(x) }))
            .filter(x => x.taxa < 75 || x.questoes < 20)
            .sort((a, b) => (a.taxa - b.taxa) || (a.questoes - b.questoes))
            .slice(0, limit);
    }

    function planAlerts() {
        const s = ensureData();
        if(!s) return [];
        const alerts = [];
        const launches = getLaunches();
        const perf = performanceData();
        if(!(s.lista || []).length) alerts.push({ level: 'danger', title: 'Edital sem matérias', text: 'Cadastre as matérias e assuntos para liberar planejamento.' });
        if(!(s.ciclo || []).length) alerts.push({ level: 'danger', title: 'Ciclo vazio', text: 'Ative pelo menos uma matéria no ciclo ativo.' });
        const noQuestions = matterList().filter(m => !perf.materias.some(x => x.nome === m && x.questoes > 0));
        if(noQuestions.length) alerts.push({ level: 'warn', title: 'Matérias sem questões', text: noQuestions.slice(0, 4).map(clean).join(', ') + (noQuestions.length > 4 ? '...' : '') });
        const lateDays = Object.keys(s.metaFixa || {}).filter(day => {
            const d = keyDate(day);
            return d < today() && (s.metaFixa[day] || []).some(t => !t.c && !isExtra(t));
        });
        if(lateDays.length) alerts.push({ level: 'warn', title: 'Pendências antigas', text: `${lateDays.length} dia(s) têm atividade não concluída.` });
        const weekKey = currentWeekKey();
        const week = weekStats(weekKey);
        if(week.horas < num(s.metasEstudo?.horasSemana) * 0.35 && new Date().getDay() >= 4) alerts.push({ level: 'info', title: 'Ritmo semanal baixo', text: `${week.horas.toFixed(1)}h registradas nesta semana.` });
        if(launches.length === 0) alerts.push({ level: 'info', title: 'Sem lançamentos ainda', text: 'Marque atividades concluídas para gerar leitura real do estudo.' });
        if(!alerts.length) alerts.push({ level: 'ok', title: 'Plano sem alertas críticos', text: 'O acompanhamento inteligente não encontrou bloqueios importantes.' });
        return alerts;
    }

    function currentWeekKey(date = new Date()) {
        const d = new Date(date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - d.getDay());
        return d.toISOString().slice(0, 10);
    }

    function weekStats(weekKey) {
        const start = new Date(`${weekKey}T00:00:00`);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return getLaunches().reduce((acc, row) => {
            const d = keyDate(row.dia);
            if(d >= start && d < end) {
                acc.horas += num(row.task.h);
                acc.questoes += int(row.task.perf?.t);
                acc.acertos += int(row.task.perf?.a);
                acc.atividades += 1;
            }
            return acc;
        }, { horas: 0, questoes: 0, acertos: 0, atividades: 0 });
    }

    function weeksBack(count = 8) {
        const base = new Date();
        base.setHours(0,0,0,0);
        base.setDate(base.getDate() - base.getDay());
        const weeks = [];
        for(let i = count - 1; i >= 0; i--) {
            const d = new Date(base);
            d.setDate(base.getDate() - i * 7);
            weeks.push(currentWeekKey(d));
        }
        return weeks;
    }

    function deadlineMode() {
        const s = ensureData();
        const raw = s?.metasEstudo?.dataProva || s?.dataProva || '';
        if(!raw) return { enabled: false, text: 'Defina a data da prova em Simulados e Metas para ativar a estratégia de reta final.' };
        const d = new Date(`${raw}T00:00:00`);
        const left = daysBetween(today(), d);
        if(left < 0) return { enabled: false, left, text: 'A data da prova informada já passou. Atualize para uma nova etapa.' };
        if(left <= 15) return { enabled: true, left, level: 'danger', title: 'Reta final forte', text: 'Priorize revisão, questões e caderno de erros. Evite abrir muitos assuntos novos.' };
        if(left <= 45) return { enabled: true, left, level: 'warn', title: 'Modo prova próxima', text: 'Aumente questões, revise pontos fracos e mantenha teoria nova só no essencial.' };
        return { enabled: true, left, level: 'info', title: 'Preparação em construção', text: 'Ainda há tempo para equilibrar teoria, revisões e exercícios.' };
    }

    function installStyle() {
        if(document.getElementById('plantao-study-intelligence-style')) return;
        const style = document.createElement('style');
        style.id = 'plantao-study-intelligence-style';
        style.textContent = `
            .study-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:18px; }
            .study-wide { grid-column:1 / -1; }
            .study-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:center; padding:14px 0; border-bottom:1px solid rgba(148,163,184,.16); }
            .study-row:last-child { border-bottom:0; }
            .study-row b, .study-row strong { color:var(--text-main,#fff); }
            .study-row small, .study-note, .study-muted { display:block; color:var(--text-sec,#b9c8df); margin-top:4px; line-height:1.35; }
            .study-score { min-width:76px; text-align:right; font-weight:800; color:#67e8f9; }
            .study-chip-list { display:flex; flex-wrap:wrap; gap:7px; margin-top:8px; }
            .study-chip { border:1px solid rgba(103,232,249,.28); background:rgba(14,165,233,.12); color:#dff7ff; border-radius:999px; padding:4px 9px; font-size:.72rem; font-weight:700; }
            .study-chip.warn { border-color:rgba(245,158,11,.35); background:rgba(245,158,11,.14); }
            .study-chip.danger { border-color:rgba(239,68,68,.35); background:rgba(239,68,68,.14); }
            .study-form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; align-items:end; }
            .study-actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:14px; }
            .study-actions .btn { width:auto; }
            .study-inline-status { color:#7dd3fc; font-weight:700; min-height:20px; }
            .study-list { display:flex; flex-direction:column; gap:10px; }
            .study-card-row { border:1px solid rgba(148,163,184,.18); border-radius:8px; padding:14px; background:rgba(15,23,42,.42); }
            .study-card-row.reviewed { opacity:.65; }
            .study-search { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:center; }
            .study-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
            .study-kpi { border:1px solid rgba(148,163,184,.18); border-radius:8px; padding:14px; background:rgba(15,23,42,.38); }
            .study-kpi small { display:block; color:var(--text-sec,#b9c8df); }
            .study-kpi strong { display:block; font-size:1.55rem; margin-top:5px; color:#fff; }
            .study-bars { display:flex; flex-direction:column; gap:10px; }
            .study-bar-row { display:grid; grid-template-columns:88px minmax(0,1fr) 92px; gap:10px; align-items:center; }
            .study-bar-track { height:10px; border-radius:999px; background:rgba(148,163,184,.16); overflow:hidden; }
            .study-bar-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,#06b6d4,#22c55e); }
            .study-alert.ok strong { color:#22c55e; }
            .study-alert.warn strong { color:#f59e0b; }
            .study-alert.danger strong { color:#fb7185; }
            .study-alert.info strong { color:#67e8f9; }
            .study-admin-table { width:100%; border-collapse:collapse; }
            .study-admin-table th, .study-admin-table td { padding:10px; border-bottom:1px solid rgba(148,163,184,.16); text-align:left; vertical-align:top; }
            @media (max-width: 720px) {
                .study-row, .study-search, .study-bar-row { grid-template-columns:1fr; }
                .study-score { text-align:left; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensurePages() {
        const submenu = document.getElementById('sub-plano');
        if(submenu && !document.querySelector('[data-study-intel-link]')) {
            const html = `
                <div class="sub-link" data-study-intel-link onclick="showTab('inteligencia')">Inteligência</div>
                <div class="sub-link" data-study-intel-link onclick="showTab('caderno-erros')">Caderno de Erros</div>
                <div class="sub-link" data-study-intel-link onclick="showTab('simulados')">Simulados e Metas</div>
                <div class="sub-link" data-study-intel-link onclick="showTab('busca-global')">Busca Global</div>
                <div class="sub-link" data-study-intel-link onclick="showTab('evolucao')">Evolução</div>`;
            submenu.insertAdjacentHTML('beforeend', html);
        }
        const container = document.querySelector('.main .container');
        if(container && !document.getElementById('inteligencia')) {
            container.insertAdjacentHTML('beforeend', `
                <div id="inteligencia" class="page"><div class="page-header"><div><h2>Inteligência de Estudo</h2><p class="meta-sub">Fila recomendada, revisões por desempenho e alertas discretos do plano.</p></div><button class="btn btn-sm btn-outline" onclick="renderInteligenciaEstudo()"><i class="fas fa-rotate"></i> ATUALIZAR</button></div><div id="inteligencia-content"></div></div>
                <div id="caderno-erros" class="page"><div class="page-header"><div><h2>Caderno de Erros</h2><p class="meta-sub">Registre erros por assunto e transforme falhas em revisão direcionada.</p></div></div><div id="caderno-erros-content"></div></div>
                <div id="simulados" class="page"><div class="page-header"><div><h2>Simulados e Metas</h2><p class="meta-sub">Controle simulados, metas semanais e estratégia para prova próxima.</p></div></div><div id="simulados-content"></div></div>
                <div id="busca-global" class="page"><div class="page-header"><div><h2>Busca Global</h2><p class="meta-sub">Encontre matérias, assuntos, lançamentos, simulados e erros.</p></div></div><div id="busca-global-content"></div></div>
                <div id="evolucao" class="page"><div class="page-header"><div><h2>Evolução</h2><p class="meta-sub">Histórico de horas, questões, acertos e simulados nas últimas semanas.</p></div><button class="btn btn-sm btn-outline" onclick="renderEvolucaoEstudo()"><i class="fas fa-rotate"></i> ATUALIZAR</button></div><div id="evolucao-content"></div></div>`);
        }
    }

    function setInline(id, message) {
        const el = document.getElementById(id);
        if(el) el.textContent = message || '';
    }

    function emptyBlock(icon, title, text) {
        return `<div class="empty-state"><i class="fas ${icon}"></i><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
    }

    function renderInteligenciaEstudo() {
        ensurePages();
        const target = document.getElementById('inteligencia-content');
        if(!target) return;
        const queue = smartQueue().slice(0, 10);
        const weak = weakSubjects(8);
        const alerts = planAlerts();
        const mode = deadlineMode();
        const week = weekStats(currentWeekKey());
        const s = ensureData();
        const hoursGoal = num(s?.metasEstudo?.horasSemana);
        const questionGoal = int(s?.metasEstudo?.questoesSemana);
        target.innerHTML = `
            <div class="study-grid">
                <div class="stat-card study-wide">
                    <h3>Fila inteligente de estudo</h3>
                    <p class="meta-sub">Recomendação calculada por peso, pendência, desempenho, revisão vencida e tempo sem contato. Ela não altera o cronograma.</p>
                    ${queue.length ? queue.map(renderQueueRow).join('') : emptyBlock('fa-list-check', 'Nada crítico na fila', 'Cadastre matérias, conclua atividades ou registre questões para gerar recomendações.')}
                </div>
                <div class="stat-card">
                    <h3>Revisões por desempenho</h3>
                    ${weak.length ? weak.map(renderWeakRow).join('') : emptyBlock('fa-bullseye', 'Sem ponto fraco evidente', 'Quando houver questões registradas, os assuntos frágeis aparecerão aqui.')}
                </div>
                <div class="stat-card">
                    <h3>Alertas discretos</h3>
                    ${alerts.map(renderAlert).join('')}
                </div>
                <div class="stat-card">
                    <h3>${esc(mode.title || 'Modo prova próxima')}</h3>
                    <p class="meta-sub">${esc(mode.text)}</p>
                    ${mode.left !== undefined ? `<div class="study-chip-list"><span class="study-chip ${mode.level || ''}">${Math.max(0, mode.left)} dia(s) restantes</span></div>` : ''}
                    <div class="study-actions"><button class="btn btn-sm btn-outline" onclick="showTab('simulados')"><i class="fas fa-flag-checkered"></i> AJUSTAR METAS</button></div>
                </div>
                <div class="stat-card study-wide">
                    <h3>Metas da semana</h3>
                    <div class="study-kpis">
                        <div class="study-kpi"><small>Horas</small><strong>${week.horas.toFixed(1)}h</strong><span class="study-muted">Meta: ${hoursGoal.toFixed(1)}h</span></div>
                        <div class="study-kpi"><small>Questões</small><strong>${week.questoes}</strong><span class="study-muted">Meta: ${questionGoal}</span></div>
                        <div class="study-kpi"><small>Precisão</small><strong>${week.questoes ? Math.round((week.acertos / week.questoes) * 100) : 0}%</strong><span class="study-muted">${week.acertos}/${week.questoes} acertos</span></div>
                    </div>
                </div>
            </div>`;
    }

    function renderQueueRow(row) {
        const item = row.item;
        const reasons = row.reasons.length ? row.reasons : ['boa próxima ação'];
        return `
            <div class="study-row">
                <div>
                    <b>${esc(clean(item.m))}</b>
                    <small>${esc(clean(item.a))}</small>
                    <div class="study-chip-list">
                        <span class="study-chip">${esc(row.status.label)}</span>
                        ${reasons.map(reason => `<span class="study-chip ${/vencida|acerto|pendente/i.test(reason) ? 'warn' : ''}">${esc(clean(reason))}</span>`).join('')}
                    </div>
                </div>
                <div class="study-score">${Math.round(row.score)} pts</div>
            </div>`;
    }

    function renderWeakRow(row) {
        return `
            <div class="study-row">
                <div>
                    <b>${esc(clean(row.materia))}</b>
                    <small>${esc(clean(row.assunto))}</small>
                    <span class="study-muted">${row.acertos}/${row.questoes} acertos</span>
                </div>
                <div class="study-score">${row.taxa}%</div>
            </div>`;
    }

    function renderAlert(alert) {
        return `
            <div class="study-row study-alert ${alert.level}">
                <div>
                    <strong>${esc(alert.title)}</strong>
                    <small>${esc(clean(alert.text))}</small>
                </div>
            </div>`;
    }

    function renderCadernoErros() {
        ensurePages();
        const target = document.getElementById('caderno-erros-content');
        const s = ensureData();
        if(!target || !s) return;
        const selectedMatter = matterList()[0] || '';
        target.innerHTML = `
            <div class="study-grid">
                <div class="stat-card study-wide">
                    <h3>Novo registro de erro</h3>
                    <div class="study-form-grid">
                        <div><label>Matéria</label><select id="erro-materia" onchange="atualizarAssuntosErro()">${matterList().map(m => `<option value="${esc(m)}">${esc(clean(m))}</option>`).join('')}</select></div>
                        <div><label>Assunto</label><select id="erro-assunto">${subjectList(selectedMatter).map(a => `<option value="${esc(a)}">${esc(clean(a))}</option>`).join('')}</select></div>
                        <div><label>Motivo</label><select id="erro-motivo"><option>Falta de teoria</option><option>Pegadinha</option><option>Desatenção</option><option>Lei seca</option><option>Jurisprudência</option><option>Esquecimento</option><option>Interpretação</option></select></div>
                        <div><label>Data</label><input type="date" id="erro-data" value="${new Date().toISOString().slice(0,10)}"></div>
                    </div>
                    <label>Observação</label><textarea id="erro-nota" placeholder="O que aconteceu e como evitar da próxima vez?"></textarea>
                    <div class="study-actions"><button class="btn" onclick="salvarErroEstudo()"><i class="fas fa-bookmark"></i> SALVAR ERRO</button><span id="erro-status" class="study-inline-status"></span></div>
                </div>
                <div class="stat-card">
                    <h3>Sugestões vindas das questões</h3>
                    ${weakSubjects(5).length ? weakSubjects(5).map(x => `<div class="study-row"><div><b>${esc(clean(x.materia))}</b><small>${esc(clean(x.assunto))}</small></div><button class="btn btn-sm btn-outline" onclick="criarErroSugerido('${encodeURIComponent(x.materia)}','${encodeURIComponent(x.assunto)}')">REGISTRAR</button></div>`).join('') : emptyBlock('fa-check', 'Sem sugestão automática', 'Assuntos com baixa precisão aparecerão aqui.')}
                </div>
                <div class="stat-card study-wide">
                    <h3>Erros registrados</h3>
                    ${renderErrorList()}
                </div>
            </div>`;
    }

    function renderErrorList() {
        const s = ensureData();
        const list = [...(s?.cadernoErros || [])].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
        if(!list.length) return emptyBlock('fa-clipboard-list', 'Caderno vazio', 'Registre erros para montar revisões direcionadas.');
        return `<div class="study-list">${list.map(item => `
            <div class="study-card-row ${item.revisado ? 'reviewed' : ''}">
                <div class="study-row">
                    <div>
                        <b>${esc(clean(item.materia))}</b>
                        <small>${esc(clean(item.assunto))}</small>
                        <div class="study-chip-list">
                            <span class="study-chip warn">${esc(item.motivo || 'Erro')}</span>
                            <span class="study-chip">${esc(item.data || '')}</span>
                            ${item.revisado ? '<span class="study-chip">revisado</span>' : ''}
                        </div>
                        ${item.nota ? `<span class="study-note">${esc(clean(item.nota))}</span>` : ''}
                    </div>
                    <div class="study-actions">
                        <button class="btn btn-sm btn-outline" onclick="alternarErroRevisado('${item.id}')">${item.revisado ? 'REABRIR' : 'REVISADO'}</button>
                        <button class="btn btn-sm btn-outline danger-btn" onclick="removerErroEstudo('${item.id}')">REMOVER</button>
                    </div>
                </div>
            </div>`).join('')}</div>`;
    }

    function updateSubjectSelect(matterId, subjectId) {
        const matter = document.getElementById(matterId)?.value || '';
        const subject = document.getElementById(subjectId);
        if(subject) subject.innerHTML = subjectList(matter).map(a => `<option value="${esc(a)}">${esc(clean(a))}</option>`).join('');
    }

    function salvarErroEstudo() {
        const s = ensureData();
        if(!s) return;
        const item = {
            id: `erro-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            materia: document.getElementById('erro-materia')?.value || '',
            assunto: document.getElementById('erro-assunto')?.value || '',
            motivo: document.getElementById('erro-motivo')?.value || '',
            data: document.getElementById('erro-data')?.value || new Date().toISOString().slice(0,10),
            nota: document.getElementById('erro-nota')?.value || '',
            revisado: false,
            createdAt: new Date().toISOString()
        };
        if(!item.materia || !item.assunto) {
            setInline('erro-status', 'Selecione matéria e assunto.');
            return;
        }
        s.cadernoErros.unshift(item);
        saveState();
        renderCadernoErros();
        setInline('erro-status', 'Erro salvo no caderno.');
    }

    function criarErroSugerido(matter, subject) {
        const s = ensureData();
        if(!s) return;
        s.cadernoErros.unshift({
            id: `erro-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            materia: decodeURIComponent(matter),
            assunto: decodeURIComponent(subject),
            motivo: 'Baixa precisão',
            data: new Date().toISOString().slice(0,10),
            nota: 'Criado a partir do desempenho em questões.',
            revisado: false,
            createdAt: new Date().toISOString()
        });
        saveState();
        renderCadernoErros();
    }

    function alternarErroRevisado(id) {
        const s = ensureData();
        const item = s?.cadernoErros?.find(x => x.id === id);
        if(!item) return;
        item.revisado = !item.revisado;
        item.revisadoEm = item.revisado ? new Date().toISOString() : '';
        saveState();
        renderCadernoErros();
    }

    function removerErroEstudo(id) {
        const s = ensureData();
        if(!s) return;
        s.cadernoErros = s.cadernoErros.filter(x => x.id !== id);
        saveState();
        renderCadernoErros();
    }

    function renderSimulados() {
        ensurePages();
        const target = document.getElementById('simulados-content');
        const s = ensureData();
        if(!target || !s) return;
        const meta = s.metasEstudo || {};
        target.innerHTML = `
            <div class="study-grid">
                <div class="stat-card study-wide">
                    <h3>Metas e prova</h3>
                    <div class="study-form-grid">
                        <div><label>Meta de horas por semana</label><input type="number" id="meta-horas" min="0" step="0.5" value="${esc(meta.horasSemana || 20)}"></div>
                        <div><label>Meta de questões por semana</label><input type="number" id="meta-questoes" min="0" step="10" value="${esc(meta.questoesSemana || 150)}"></div>
                        <div><label>Data da prova</label><input type="date" id="meta-prova" value="${esc(meta.dataProva || '')}"></div>
                    </div>
                    <div class="study-actions"><button class="btn" onclick="salvarMetasEstudo()"><i class="fas fa-bullseye"></i> SALVAR METAS</button><span id="metas-status" class="study-inline-status"></span></div>
                </div>
                <div class="stat-card study-wide">
                    <h3>Novo simulado</h3>
                    <div class="study-form-grid">
                        <div><label>Data</label><input type="date" id="sim-data" value="${new Date().toISOString().slice(0,10)}"></div>
                        <div><label>Nome</label><input type="text" id="sim-nome" placeholder="Simulado PRF, bloco 1..."></div>
                        <div><label>Questões</label><input type="number" id="sim-questoes" min="0" value="0"></div>
                        <div><label>Acertos</label><input type="number" id="sim-acertos" min="0" value="0"></div>
                        <div><label>Duração (h)</label><input type="number" id="sim-horas" min="0" step="0.5" value="0"></div>
                    </div>
                    <label>Observação</label><textarea id="sim-nota" placeholder="Quais matérias derrubaram sua nota?"></textarea>
                    <div class="study-actions"><button class="btn" onclick="salvarSimulado()"><i class="fas fa-clipboard-check"></i> SALVAR SIMULADO</button><span id="sim-status" class="study-inline-status"></span></div>
                </div>
                <div class="stat-card">${renderDeadlineCard()}</div>
                <div class="stat-card study-wide">
                    <h3>Histórico de simulados</h3>
                    ${renderSimuladoList()}
                </div>
            </div>`;
    }

    function renderDeadlineCard() {
        const mode = deadlineMode();
        return `
            <h3>${esc(mode.title || 'Estratégia de prova')}</h3>
            <p class="meta-sub">${esc(mode.text)}</p>
            <div class="study-chip-list">
                ${mode.left !== undefined ? `<span class="study-chip ${mode.level || ''}">${Math.max(0, mode.left)} dia(s)</span>` : '<span class="study-chip">sem data</span>'}
                <span class="study-chip">questões + revisão + caderno</span>
            </div>`;
    }

    function salvarMetasEstudo() {
        const s = ensureData();
        if(!s) return;
        s.metasEstudo.horasSemana = Math.max(0, num(document.getElementById('meta-horas')?.value));
        s.metasEstudo.questoesSemana = Math.max(0, int(document.getElementById('meta-questoes')?.value));
        s.metasEstudo.dataProva = document.getElementById('meta-prova')?.value || '';
        s.dataProva = s.metasEstudo.dataProva;
        saveState();
        renderSimulados();
        setInline('metas-status', 'Metas salvas.');
    }

    function salvarSimulado() {
        const s = ensureData();
        if(!s) return;
        const total = Math.max(0, int(document.getElementById('sim-questoes')?.value));
        const acertos = Math.min(total || 99999, Math.max(0, int(document.getElementById('sim-acertos')?.value)));
        s.simulados.unshift({
            id: `sim-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            data: document.getElementById('sim-data')?.value || new Date().toISOString().slice(0,10),
            nome: document.getElementById('sim-nome')?.value || 'Simulado',
            questoes: total,
            acertos,
            horas: Math.max(0, num(document.getElementById('sim-horas')?.value)),
            nota: document.getElementById('sim-nota')?.value || '',
            createdAt: new Date().toISOString()
        });
        saveState();
        renderSimulados();
        setInline('sim-status', 'Simulado salvo.');
    }

    function renderSimuladoList() {
        const s = ensureData();
        const list = [...(s?.simulados || [])].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
        if(!list.length) return emptyBlock('fa-clipboard-question', 'Nenhum simulado salvo', 'Registre simulados para acompanhar a evolução da nota.');
        return `<div class="study-list">${list.map(sim => {
            const pct = sim.questoes ? Math.round((sim.acertos / sim.questoes) * 100) : 0;
            return `
                <div class="study-card-row">
                    <div class="study-row">
                        <div>
                            <b>${esc(clean(sim.nome))}</b>
                            <small>${esc(sim.data || '')} | ${sim.acertos}/${sim.questoes} acertos | ${pct}% | ${num(sim.horas).toFixed(1)}h</small>
                            ${sim.nota ? `<span class="study-note">${esc(clean(sim.nota))}</span>` : ''}
                        </div>
                        <button class="btn btn-sm btn-outline danger-btn" onclick="removerSimulado('${sim.id}')">REMOVER</button>
                    </div>
                </div>`;
        }).join('')}</div>`;
    }

    function removerSimulado(id) {
        const s = ensureData();
        if(!s) return;
        s.simulados = s.simulados.filter(x => x.id !== id);
        saveState();
        renderSimulados();
    }

    function renderBuscaGlobal() {
        ensurePages();
        const target = document.getElementById('busca-global-content');
        if(!target) return;
        target.innerHTML = `
            <div class="stat-card">
                <div class="study-search">
                    <input type="search" id="busca-global-input" placeholder="Buscar matéria, assunto, erro, simulado ou lançamento..." oninput="executarBuscaGlobal()">
                    <button class="btn btn-outline" onclick="executarBuscaGlobal()"><i class="fas fa-magnifying-glass"></i> BUSCAR</button>
                </div>
            </div>
            <div id="busca-global-results" class="study-grid" style="margin-top:18px;"></div>`;
        setTimeout(() => document.getElementById('busca-global-input')?.focus(), 50);
        executarBuscaGlobal();
    }

    function searchRows() {
        const s = ensureData();
        const rows = [];
        (s?.lista || []).forEach(item => rows.push({
            type: 'Assunto',
            title: clean(item.a),
            subtitle: clean(item.m),
            text: `${item.m} ${item.a}`,
            extra: item.f ? 'concluído' : 'pendente'
        }));
        getLaunches().forEach(({ dia, task }) => rows.push({
            type: 'Lançamento',
            title: clean(task.a),
            subtitle: `${clean(task.m)} | ${dia}`,
            text: `${task.m} ${task.a} ${dia} ${task.l}`,
            extra: `${num(task.h).toFixed(1)}h`
        }));
        (s?.cadernoErros || []).forEach(item => rows.push({
            type: 'Erro',
            title: clean(item.assunto),
            subtitle: `${clean(item.materia)} | ${item.motivo}`,
            text: `${item.materia} ${item.assunto} ${item.motivo} ${item.nota}`,
            extra: item.revisado ? 'revisado' : 'aberto'
        }));
        (s?.simulados || []).forEach(sim => rows.push({
            type: 'Simulado',
            title: clean(sim.nome),
            subtitle: sim.data || '',
            text: `${sim.nome} ${sim.data} ${sim.nota}`,
            extra: `${sim.acertos}/${sim.questoes}`
        }));
        return rows;
    }

    function executarBuscaGlobal() {
        const target = document.getElementById('busca-global-results');
        if(!target) return;
        const q = clean(document.getElementById('busca-global-input')?.value || '').toLowerCase().trim();
        const rows = searchRows().filter(row => !q || clean(row.text).toLowerCase().includes(q)).slice(0, 80);
        if(!rows.length) {
            target.innerHTML = `<div class="stat-card study-wide">${emptyBlock('fa-magnifying-glass', 'Nenhum resultado', 'Tente buscar por outra palavra.')}</div>`;
            return;
        }
        target.innerHTML = `
            <div class="stat-card study-wide">
                <h3>${rows.length} resultado(s)</h3>
                ${rows.map(row => `
                    <div class="study-row">
                        <div>
                            <b>${esc(row.title)}</b>
                            <small>${esc(row.subtitle)}</small>
                            <div class="study-chip-list"><span class="study-chip">${esc(row.type)}</span><span class="study-chip">${esc(row.extra)}</span></div>
                        </div>
                    </div>`).join('')}
            </div>`;
    }

    function renderEvolucaoEstudo() {
        ensurePages();
        const target = document.getElementById('evolucao-content');
        const s = ensureData();
        if(!target || !s) return;
        const weeks = weeksBack(8).map(key => ({ key, ...weekStats(key) }));
        const maxHours = Math.max(1, ...weeks.map(w => w.horas));
        const maxQuestions = Math.max(1, ...weeks.map(w => w.questoes));
        const sims = [...(s.simulados || [])].sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
        const total = weeks.reduce((acc, w) => {
            acc.horas += w.horas; acc.questoes += w.questoes; acc.acertos += w.acertos; return acc;
        }, { horas:0, questoes:0, acertos:0 });
        target.innerHTML = `
            <div class="study-grid">
                <div class="stat-card study-wide">
                    <h3>Resumo das últimas 8 semanas</h3>
                    <div class="study-kpis">
                        <div class="study-kpi"><small>Horas</small><strong>${total.horas.toFixed(1)}h</strong></div>
                        <div class="study-kpi"><small>Questões</small><strong>${total.questoes}</strong></div>
                        <div class="study-kpi"><small>Precisão</small><strong>${total.questoes ? Math.round((total.acertos / total.questoes) * 100) : 0}%</strong></div>
                    </div>
                </div>
                <div class="stat-card">
                    <h3>Horas por semana</h3>
                    <div class="study-bars">${weeks.map(w => renderBar(w.key.slice(5), w.horas, maxHours, `${w.horas.toFixed(1)}h`)).join('')}</div>
                </div>
                <div class="stat-card">
                    <h3>Questões por semana</h3>
                    <div class="study-bars">${weeks.map(w => renderBar(w.key.slice(5), w.questoes, maxQuestions, `${w.questoes}`)).join('')}</div>
                </div>
                <div class="stat-card study-wide">
                    <h3>Evolução dos simulados</h3>
                    ${sims.length ? sims.map(sim => {
                        const pct = sim.questoes ? Math.round((sim.acertos / sim.questoes) * 100) : 0;
                        return renderBar(`${sim.data || ''} ${clean(sim.nome || '')}`.slice(0, 32), pct, 100, `${pct}%`);
                    }).join('') : emptyBlock('fa-chart-line', 'Sem simulados', 'Registre simulados para ver evolução da nota.')}
                </div>
            </div>`;
    }

    function renderBar(label, value, max, display) {
        const pct = Math.max(2, Math.min(100, Math.round((value / max) * 100)));
        return `<div class="study-bar-row"><small>${esc(label)}</small><div class="study-bar-track"><div class="study-bar-fill" style="width:${pct}%"></div></div><strong>${esc(display)}</strong></div>`;
    }

    async function renderPainelProfessor() {
        const target = document.getElementById('study-admin-panel');
        const s = state();
        if(!target || !fn('usuarioAdmin')?.()) return;
        const supabaseClient = (() => { try { return Function('return typeof supabaseClient === "undefined" ? null : supabaseClient;')(); } catch(_) { return null; } })();
        const adminAccessList = (() => { try { return Function('return typeof adminAccessList === "undefined" ? [] : adminAccessList;')(); } catch(_) { return []; } })();
        if(!supabaseClient) {
            target.innerHTML = emptyBlock('fa-user-shield', 'Painel do professor indisponível', 'Entre como admin conectado ao Supabase para carregar a leitura dos alunos.');
            return;
        }
        target.innerHTML = emptyBlock('fa-spinner', 'Carregando painel do professor', 'Buscando alunos aprovados e indicadores de estudo.');
        try {
            if(!adminAccessList.length && fn('carregarSolicitacoesAcesso')) await fn('carregarSolicitacoesAcesso')();
            const latestList = (() => { try { return Function('return typeof adminAccessList === "undefined" ? [] : adminAccessList;')(); } catch(_) { return []; } })();
            const students = latestList.filter(item => item.email && item.email !== 'matheus34212019@gmail.com' && item.status === 'approved' && item.user_id);
            if(!students.length) {
                target.innerHTML = emptyBlock('fa-user-group', 'Sem alunos aprovados com dados', 'Aprove alunos e aguarde o primeiro salvamento deles.');
                return;
            }
            const { data, error } = await supabaseClient.from('plantao_user_data').select('user_id,email,data').in('user_id', students.map(x => x.user_id));
            if(error) throw error;
            const byId = new Map((data || []).map(row => [row.user_id, row.data || {}]));
            const rows = students.map(student => {
                const d = byId.get(student.user_id) || {};
                const launches = getLaunches(d);
                const last = launches[0]?.dia || '';
                const week = weekStatsForDb(d);
                const totalQuestions = launches.reduce((acc, row) => acc + int(row.task.perf?.t), 0);
                const totalHits = launches.reduce((acc, row) => acc + int(row.task.perf?.a), 0);
                const alerts = [];
                if(!(d.lista || []).length) alerts.push('sem matérias');
                if(!(d.ciclo || []).length) alerts.push('sem ciclo');
                if(!launches.length) alerts.push('sem lançamentos');
                if(last && daysBetween(keyDate(last), today()) > 7) alerts.push('7+ dias sem estudo');
                if(totalQuestions > 0 && Math.round((totalHits / totalQuestions) * 100) < 60) alerts.push('baixa precisão');
                return {
                    name: d.perfilNome || student.name || student.email,
                    email: student.email,
                    subjects: (d.lista || []).length,
                    weekHours: week.horas,
                    questions: totalQuestions,
                    precision: totalQuestions ? Math.round((totalHits / totalQuestions) * 100) : 0,
                    last,
                    alerts
                };
            }).sort((a, b) => b.alerts.length - a.alerts.length || a.name.localeCompare(b.name));
            target.innerHTML = `
                <div class="stat-card study-wide">
                    <div class="admin-access-head"><div><h3>Painel do professor</h3><p class="meta-sub">Leitura discreta de risco, ritmo e pendências dos alunos.</p></div><button class="btn btn-sm btn-outline" onclick="renderPainelProfessor()"><i class="fas fa-rotate"></i> ATUALIZAR</button></div>
                    <div style="overflow:auto;">
                        <table class="study-admin-table">
                            <thead><tr><th>Aluno</th><th>Semana</th><th>Questões</th><th>Precisão</th><th>Último estudo</th><th>Atenção</th></tr></thead>
                            <tbody>${rows.map(row => `<tr><td><b>${esc(clean(row.name))}</b><small>${esc(row.email)}</small></td><td>${row.weekHours.toFixed(1)}h</td><td>${row.questions}</td><td>${row.precision}%</td><td>${esc(row.last || 'sem registro')}</td><td>${row.alerts.length ? row.alerts.map(a => `<span class="study-chip warn">${esc(a)}</span>`).join(' ') : '<span class="study-chip">ok</span>'}</td></tr>`).join('')}</tbody>
                        </table>
                    </div>
                </div>`;
        } catch(e) {
            target.innerHTML = emptyBlock('fa-triangle-exclamation', 'Não foi possível carregar o painel', clean(e?.message || e));
        }
    }

    function weekStatsForDb(source) {
        const start = new Date();
        start.setHours(0,0,0,0);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return getLaunches(source).reduce((acc, row) => {
            const d = keyDate(row.dia);
            if(d >= start && d < end) acc.horas += num(row.task.h);
            return acc;
        }, { horas: 0 });
    }

    function enhanceRankingPage() {
        const page = document.getElementById('ranking');
        if(!page || document.getElementById('study-admin-panel')) return;
        const header = page.querySelector('.page-header');
        if(header) header.insertAdjacentHTML('afterend', '<div id="study-admin-panel" class="study-grid" style="margin-bottom:18px;"></div>');
    }

    function dispatchPage(id) {
        if(id === 'inteligencia') renderInteligenciaEstudo();
        if(id === 'caderno-erros') renderCadernoErros();
        if(id === 'simulados') renderSimulados();
        if(id === 'busca-global') renderBuscaGlobal();
        if(id === 'evolucao') renderEvolucaoEstudo();
        if(id === 'ranking') {
            enhanceRankingPage();
            renderPainelProfessor();
        }
    }

    function patchShowTab() {
        const original = fn('showTab');
        if(!original || original[WRAPPED]) return false;
        function studyShowTab(id, el) {
            ensurePages();
            const result = original.apply(this, arguments);
            dispatchPage(String(id || ''));
            return result;
        }
        studyShowTab[WRAPPED] = true;
        studyShowTab.__plantaoOriginal = original;
        if(original.__plantaoSubtleSystemWrapped) studyShowTab.__plantaoSubtleSystemWrapped = true;
        setFn('showTab', studyShowTab);
        return true;
    }

    function patchSaveRenderRefresh() {
        const original = fn('renderPerformance');
        if(original && !original.__plantaoStudyRefreshWrapped) {
            function renderPerformanceWithIntel() {
                const result = original.apply(this, arguments);
                if(document.getElementById('inteligencia')?.classList.contains('active')) renderInteligenciaEstudo();
                if(document.getElementById('evolucao')?.classList.contains('active')) renderEvolucaoEstudo();
                return result;
            }
            renderPerformanceWithIntel.__plantaoStudyRefreshWrapped = true;
            setFn('renderPerformance', renderPerformanceWithIntel);
        }
    }

    function installGlobals() {
        window.renderInteligenciaEstudo = renderInteligenciaEstudo;
        window.renderCadernoErros = renderCadernoErros;
        window.renderSimulados = renderSimulados;
        window.renderBuscaGlobal = renderBuscaGlobal;
        window.renderEvolucaoEstudo = renderEvolucaoEstudo;
        window.renderPainelProfessor = renderPainelProfessor;
        window.atualizarAssuntosErro = () => updateSubjectSelect('erro-materia', 'erro-assunto');
        window.salvarErroEstudo = salvarErroEstudo;
        window.criarErroSugerido = criarErroSugerido;
        window.alternarErroRevisado = alternarErroRevisado;
        window.removerErroEstudo = removerErroEstudo;
        window.salvarMetasEstudo = salvarMetasEstudo;
        window.salvarSimulado = salvarSimulado;
        window.removerSimulado = removerSimulado;
        window.executarBuscaGlobal = executarBuscaGlobal;
        window.__plantaoStudyIntelligenceVersion = VERSION;
    }

    function install() {
        if(!state()) return false;
        installStyle();
        installGlobals();
        ensureData();
        ensurePages();
        patchShowTab();
        patchSaveRenderRefresh();
        enhanceRankingPage();
        if(document.getElementById('inteligencia')?.classList.contains('active')) renderInteligenciaEstudo();
        return true;
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, true);
    } else {
        install();
    }
    let tries = 0;
    const timer = setInterval(() => {
        tries += 1;
        if(install() || tries > 120) clearInterval(timer);
    }, 250);
})();
