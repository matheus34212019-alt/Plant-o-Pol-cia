(function plantaoEvolutionCalendar() {
    if(window.__plantaoEvolutionCalendar) return;
    window.__plantaoEvolutionCalendar = true;

    const VERSION = 'v218-month-calendar';
    const DAY_MS = 86400000;

    function getDb() {
        try { return Function('return typeof db === "undefined" ? null : db;')(); }
        catch(_) { return window.db || null; }
    }

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function setFn(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function esc(value) {
        const escapeHtml = fn('escapeHtml');
        const text = String(value ?? '');
        if(escapeHtml) return escapeHtml(text);
        return text.replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
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

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function dateKey(date) {
        const local = fn('dateKey');
        if(local) {
            try { return local(date); } catch(_) {}
        }
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    }

    function keyDate(key) {
        const local = fn('keyToDate');
        if(local) {
            try { return local(key); } catch(_) {}
        }
        const parts = String(key || '').split('/').map(Number);
        if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        return new Date(key);
    }

    function isExtra(task) {
        const local = fn('isExtraTask');
        if(local) {
            try { return local(task); } catch(_) {}
        }
        return task?.extra === true || task?.l === 'Extra';
    }

    function currentMonthDate() {
        if(window.__plantaoEvolutionMonth) {
            const parsed = new Date(`${window.__plantaoEvolutionMonth}-01T00:00:00`);
            if(!Number.isNaN(parsed.getTime())) return parsed;
        }
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    }

    function monthLabel(date) {
        return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    function launchesForMonth(monthDate) {
        const db = getDb();
        const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
        const byDay = new Map();
        Object.entries(db?.metaFixa || {}).forEach(([key, tasks]) => {
            const day = keyDate(key);
            if(Number.isNaN(day.getTime()) || day < start || day >= end) return;
            (tasks || []).forEach(task => {
                if(!task?.c || isExtra(task)) return;
                const row = byDay.get(key) || {
                    key,
                    date: day,
                    hours: 0,
                    questions: 0,
                    hits: 0,
                    tasks: 0,
                    subjects: new Set()
                };
                row.hours += num(task.h);
                row.questions += int(task.perf?.t);
                row.hits += int(task.perf?.a);
                row.tasks += 1;
                if(task.m) row.subjects.add(clean(task.m));
                byDay.set(key, row);
            });
        });
        return byDay;
    }

    function monthCells(monthDate, byDay) {
        const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        const cells = [];
        for(let i = 0; i < first.getDay(); i += 1) cells.push({ empty: true });
        for(let d = 1; d <= last.getDate(); d += 1) {
            const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), d);
            const key = dateKey(date);
            cells.push({
                empty: false,
                key,
                date,
                stats: byDay.get(key) || {
                    key,
                    date,
                    hours: 0,
                    questions: 0,
                    hits: 0,
                    tasks: 0,
                    subjects: new Set()
                }
            });
        }
        while(cells.length % 7 !== 0) cells.push({ empty: true });
        return cells;
    }

    function monthTotals(byDay) {
        const rows = [...byDay.values()];
        const totals = rows.reduce((acc, row) => {
            acc.hours += row.hours;
            acc.questions += row.questions;
            acc.hits += row.hits;
            acc.tasks += row.tasks;
            if(row.hours > 0 || row.questions > 0) acc.activeDays += 1;
            if(row.hours > acc.bestHours.hours) acc.bestHours = row;
            if(row.questions > acc.bestQuestions.questions) acc.bestQuestions = row;
            return acc;
        }, {
            hours: 0,
            questions: 0,
            hits: 0,
            tasks: 0,
            activeDays: 0,
            bestHours: { hours: 0, key: '' },
            bestQuestions: { questions: 0, key: '' }
        });
        totals.precision = totals.questions ? Math.round((totals.hits / totals.questions) * 100) : 0;
        return totals;
    }

    function renderCalendarCell(cell, maxHours, maxQuestions) {
        if(cell.empty) return '<div class="study-month-cell is-empty"></div>';
        const todayKey = dateKey(new Date());
        const stats = cell.stats;
        const hasStudy = stats.hours > 0 || stats.questions > 0;
        const precision = stats.questions ? Math.round((stats.hits / stats.questions) * 100) : 0;
        const hourPct = Math.max(0, Math.min(100, Math.round((stats.hours / maxHours) * 100)));
        const questionPct = Math.max(0, Math.min(100, Math.round((stats.questions / maxQuestions) * 100)));
        const title = [...stats.subjects].slice(0, 3).join(', ');
        return `
            <div class="study-month-cell ${hasStudy ? 'has-study' : ''} ${cell.key === todayKey ? 'is-today' : ''}" title="${esc(title)}">
                <div class="study-month-day">${cell.date.getDate()}</div>
                <div class="study-month-metric"><b>${stats.hours.toFixed(1)}h</b><span>${stats.questions} q.</span></div>
                <div class="study-month-bars" aria-hidden="true">
                    <i class="hours" style="width:${hourPct}%"></i>
                    <i class="questions" style="width:${questionPct}%"></i>
                </div>
                <small>${stats.questions ? `${precision}% acerto` : (hasStudy ? `${stats.tasks} atividade(s)` : 'sem registro')}</small>
            </div>`;
    }

    function renderSimuladosDoMes(monthDate, db) {
        const prefix = `${monthDate.getFullYear()}-${pad(monthDate.getMonth() + 1)}`;
        const sims = [...(db?.simulados || [])]
            .filter(sim => String(sim.data || '').startsWith(prefix))
            .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
        if(!sims.length) {
            return '<div class="study-calendar-empty">Nenhum simulado registrado neste mês.</div>';
        }
        return sims.map(sim => {
            const questions = int(sim.questoes);
            const hits = int(sim.acertos);
            const pct = questions ? Math.round((hits / questions) * 100) : 0;
            return `<div class="study-month-sim"><b>${esc(clean(sim.nome || 'Simulado'))}</b><span>${esc(sim.data || '')} | ${hits}/${questions} | ${pct}%</span></div>`;
        }).join('');
    }

    function installStyle() {
        if(document.getElementById('study-month-calendar-style')) return;
        const style = document.createElement('style');
        style.id = 'study-month-calendar-style';
        style.textContent = `
            .study-month-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
            .study-month-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
            .study-month-title h3{text-transform:capitalize;margin:0}
            .study-month-actions{display:flex;gap:8px;flex-wrap:wrap}
            .study-month-calendar{display:grid;grid-template-columns:repeat(7,minmax(108px,1fr));gap:10px}
            .study-month-weekday{color:var(--text-sec);font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:0;text-align:center}
            .study-month-cell{min-height:116px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.52);border-radius:8px;padding:10px;display:grid;gap:7px;align-content:start}
            .study-month-cell.has-study{border-color:rgba(34,211,238,.45);background:linear-gradient(180deg,rgba(14,165,233,.16),rgba(15,23,42,.72))}
            .study-month-cell.is-today{outline:2px solid rgba(45,212,191,.9);outline-offset:1px}
            .study-month-cell.is-empty{opacity:.32;background:rgba(15,23,42,.18)}
            .study-month-day{width:28px;height:28px;border-radius:999px;display:grid;place-items:center;background:rgba(148,163,184,.14);font-weight:900;color:#f8fafc}
            .study-month-metric{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
            .study-month-metric b{font-size:1.15rem;color:#fff}
            .study-month-metric span{font-size:.82rem;color:#bfdbfe;font-weight:800;white-space:nowrap}
            .study-month-bars{display:grid;gap:4px}
            .study-month-bars i{display:block;height:5px;border-radius:999px;min-width:2px}
            .study-month-bars .hours{background:linear-gradient(90deg,#22d3ee,#14b8a6)}
            .study-month-bars .questions{background:linear-gradient(90deg,#a78bfa,#38bdf8)}
            .study-month-cell small{color:var(--text-sec);font-weight:800}
            .study-month-legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--text-sec);font-size:.82rem;font-weight:800}
            .study-month-legend span{display:inline-flex;align-items:center;gap:6px}
            .study-month-legend i{width:18px;height:6px;border-radius:999px;display:inline-block}
            .study-month-legend .hours{background:linear-gradient(90deg,#22d3ee,#14b8a6)}
            .study-month-legend .questions{background:linear-gradient(90deg,#a78bfa,#38bdf8)}
            .study-month-sim{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid rgba(148,163,184,.14)}
            .study-month-sim:first-child{border-top:0}
            .study-month-sim span{color:var(--text-sec);font-weight:800}
            .study-calendar-empty{color:var(--text-sec);font-weight:800;padding:10px 0}
            @media(max-width:980px){.study-month-calendar{grid-template-columns:repeat(4,minmax(116px,1fr))}.study-month-weekday{display:none}}
            @media(max-width:640px){.study-month-calendar{grid-template-columns:repeat(2,minmax(0,1fr))}.study-month-cell{min-height:104px}.study-month-actions{width:100%}.study-month-actions .btn{flex:1}}
        `;
        document.head.appendChild(style);
    }

    function renderEvolucaoEstudo() {
        const target = document.getElementById('evolucao-content');
        const db = getDb();
        if(!target || !db) return;
        installStyle();
        const month = currentMonthDate();
        const byDay = launchesForMonth(month);
        const totals = monthTotals(byDay);
        const cells = monthCells(month, byDay);
        const maxHours = Math.max(1, ...cells.filter(c => !c.empty).map(c => c.stats.hours));
        const maxQuestions = Math.max(1, ...cells.filter(c => !c.empty).map(c => c.stats.questions));
        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        target.innerHTML = `
            <div class="study-grid">
                <div class="stat-card study-wide">
                    <div class="study-month-head">
                        <div class="study-month-title">
                            <h3>${esc(monthLabel(month))}</h3>
                            <div class="study-month-legend">
                                <span><i class="hours"></i> horas</span>
                                <span><i class="questions"></i> questões</span>
                            </div>
                        </div>
                        <div class="study-month-actions">
                            <button class="btn btn-sm btn-outline" onclick="mudarMesEvolucao(-1)"><i class="fas fa-chevron-left"></i> MÊS ANTERIOR</button>
                            <button class="btn btn-sm btn-outline" onclick="irMesAtualEvolucao()">MÊS ATUAL</button>
                            <button class="btn btn-sm btn-outline" onclick="mudarMesEvolucao(1)">PRÓXIMO <i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>
                    <div class="study-kpis">
                        <div class="study-kpi"><small>Horas no mês</small><strong>${totals.hours.toFixed(1)}h</strong></div>
                        <div class="study-kpi"><small>Questões no mês</small><strong>${totals.questions}</strong></div>
                        <div class="study-kpi"><small>Precisão</small><strong>${totals.precision}%</strong></div>
                        <div class="study-kpi"><small>Dias com estudo</small><strong>${totals.activeDays}</strong></div>
                    </div>
                </div>
                <div class="stat-card study-wide">
                    <div class="study-month-calendar">
                        ${weekdays.map(day => `<div class="study-month-weekday">${day}</div>`).join('')}
                        ${cells.map(cell => renderCalendarCell(cell, maxHours, maxQuestions)).join('')}
                    </div>
                </div>
                <div class="stat-card">
                    <h3>Melhor dia em horas</h3>
                    <div class="study-kpi"><small>${esc(totals.bestHours.key || 'sem registro')}</small><strong>${(totals.bestHours.hours || 0).toFixed(1)}h</strong></div>
                </div>
                <div class="stat-card">
                    <h3>Melhor dia em questões</h3>
                    <div class="study-kpi"><small>${esc(totals.bestQuestions.key || 'sem registro')}</small><strong>${totals.bestQuestions.questions || 0}</strong></div>
                </div>
                <div class="stat-card study-wide">
                    <h3>Simulados do mês</h3>
                    ${renderSimuladosDoMes(month, db)}
                </div>
            </div>`;
        document.documentElement.dataset.evolutionCalendar = VERSION;
    }

    function shiftMonth(delta) {
        const current = currentMonthDate();
        current.setMonth(current.getMonth() + delta);
        window.__plantaoEvolutionMonth = `${current.getFullYear()}-${pad(current.getMonth() + 1)}`;
        renderEvolucaoEstudo();
    }

    function currentMonth() {
        const today = new Date();
        window.__plantaoEvolutionMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
        renderEvolucaoEstudo();
    }

    function install() {
        setFn('renderEvolucaoEstudo', renderEvolucaoEstudo);
        window.mudarMesEvolucao = shiftMonth;
        window.irMesAtualEvolucao = currentMonth;
        if(document.getElementById('evolucao')?.classList.contains('active')) renderEvolucaoEstudo();
        if(window.__plantaoEvolutionShowTabWrapped) return;
        const originalShowTab = fn('showTab');
        if(typeof originalShowTab === 'function') {
            function wrappedShowTab(id) {
                const result = originalShowTab.apply(this, arguments);
                if(id === 'evolucao') setTimeout(renderEvolucaoEstudo, 0);
                return result;
            }
            wrappedShowTab.__plantaoOriginal = originalShowTab;
            setFn('showTab', wrappedShowTab);
            window.__plantaoEvolutionShowTabWrapped = true;
        }
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();

    let tries = 0;
    const retry = setInterval(() => {
        tries += 1;
        install();
        if(tries > 30) clearInterval(retry);
    }, 300);
})();
