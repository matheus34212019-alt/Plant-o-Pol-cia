(function plantaoScheduleHardening() {
    if(window.__plantaoScheduleHardening) return;
    window.__plantaoScheduleHardening = true;

    const VERSION = 'v213-security-time';
    const TIMER_MIN_SECONDS = 30;
    const activeTimers = {};

    function globalValue(name, fallback = null) {
        try { return Function(`return typeof ${name} === "undefined" ? null : ${name};`)() ?? fallback; } catch(_) { return fallback; }
    }

    function callGlobal(name, args = []) {
        const fn = globalValue(name);
        if(typeof fn !== 'function') return null;
        return fn.apply(window, args);
    }

    function dbRef() {
        return globalValue('db');
    }

    function parseDateOnly(value) {
        if(value instanceof Date && !Number.isNaN(value.getTime())) {
            return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
        }
        const raw = String(value || '').trim();
        let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if(match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
        match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if(match) {
            let first = Number(match[1]);
            let second = Number(match[2]);
            const year = Number(match[3]);
            let day = first;
            let month = second;
            if(first <= 12 && second > 12) {
                day = second;
                month = first;
            }
            return new Date(year, month - 1, day, 12, 0, 0, 0);
        }
        const parsed = new Date(raw);
        if(!Number.isNaN(parsed.getTime())) {
            return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
        }
        return null;
    }

    function dateKeyFixed(date) {
        const d = parseDateOnly(date) || parseDateOnly(new Date());
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
    }

    function keyToDateFixed(key) {
        return parseDateOnly(key) || parseDateOnly(new Date());
    }

    function addDaysFixed(date, days) {
        const d = keyToDateFixed(date);
        d.setDate(d.getDate() + (Number(days) || 0));
        return d;
    }

    function canonicalDateKey(key) {
        const d = parseDateOnly(key);
        return d ? dateKeyFixed(d) : null;
    }

    function normalizeDateMap(map) {
        if(!map || typeof map !== 'object' || Array.isArray(map)) return {};
        return Object.entries(map).reduce((acc, [key, value]) => {
            const normalized = canonicalDateKey(key);
            if(!normalized) return acc;
            if(Array.isArray(value)) {
                acc[normalized] = [...(Array.isArray(acc[normalized]) ? acc[normalized] : []), ...value];
            } else if(value && typeof value === 'object') {
                acc[normalized] = {...(acc[normalized] || {}), ...value};
            } else {
                acc[normalized] = value;
            }
            return acc;
        }, {});
    }

    function installDateApi() {
        window.parseDateOnly = parseDateOnly;
        window.dateKey = dateKeyFixed;
        window.keyToDate = keyToDateFixed;
        window.addDays = addDaysFixed;
        window.canonicalDateKey = canonicalDateKey;
        window.normalizeDateKeyedMap = normalizeDateMap;
    }

    function normalizeDbDates() {
        const db = dbRef();
        if(!db || typeof db !== 'object') return false;
        db.metaFixa = normalizeDateMap(db.metaFixa);
        db.planosTravados = normalizeDateMap(db.planosTravados);
        db.diasPausados = Array.isArray(db.diasPausados)
            ? [...new Set(db.diasPausados.map(canonicalDateKey).filter(Boolean))]
            : [];
        if(Array.isArray(db.lista)) {
            db.lista.forEach(item => {
                if(!item || typeof item !== 'object') return;
                item.lastInitialStudyDate = canonicalDateKey(item.lastInitialStudyDate) || null;
                item.lastInitialRevDate = canonicalDateKey(item.lastInitialRevDate) || null;
                if(item.revCycle?.due) item.revCycle.due = canonicalDateKey(item.revCycle.due) || dateKeyFixed(addDaysFixed(new Date(), 1));
            });
        }
        if(Array.isArray(db.lancamentos)) {
            db.lancamentos.forEach(row => {
                if(row?.dia) row.dia = canonicalDateKey(row.dia) || row.dia;
            });
        }
        try { localStorage.setItem('prf_v120', JSON.stringify(db)); } catch(_) {}
        return true;
    }

    function wrapNormalizer() {
        const original = globalValue('normalizarBanco');
        if(typeof original !== 'function' || original.__plantaoScheduleHardeningWrapped) return false;
        window.normalizarBanco = function normalizarBancoComDatasFixas() {
            const result = original.apply(this, arguments);
            normalizeDbDates();
            return result;
        };
        window.normalizarBanco.__plantaoScheduleHardeningWrapped = true;
        return true;
    }

    function isExtraTask(task) {
        return task?.extra === true || task?.l === 'Extra';
    }

    function plannedTasks(tasks) {
        return (tasks || []).filter(t => !isExtraTask(t));
    }

    function wrapDelayCollectors() {
        window.getAtrasosAteHoje = function getAtrasosAteHojeSeguro(hoje) {
            const db = dbRef();
            const today = keyToDateFixed(hoje || new Date());
            const out = [];
            Object.entries(db?.metaFixa || {}).forEach(([key, tasks]) => {
                const d = keyToDateFixed(key);
                if(d >= today) return;
                plannedTasks(tasks).filter(t => !t.c).forEach(task => out.push({ task, dia: key }));
            });
            return out.sort((a, b) => keyToDateFixed(a.dia) - keyToDateFixed(b.dia));
        };
        window.getPrimeiroDiaAtrasado = function getPrimeiroDiaAtrasadoSeguro(hoje = new Date()) {
            const atrasos = window.getAtrasosAteHoje(hoje);
            return atrasos.length ? atrasos[0].dia : null;
        };
    }

    function safeId(value) {
        return String(value || '').replace(/[^a-z0-9]/gi, '-');
    }

    function jsString(value) {
        return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function taskIndex(day, task, fallback) {
        const db = dbRef();
        const list = db?.metaFixa?.[day] || [];
        const found = list.indexOf(task);
        return found >= 0 ? found : fallback;
    }

    function wrapTaskRenderer() {
        const original = globalValue('renderTaskCard');
        if(typeof original !== 'function' || original.__plantaoScheduleHardeningWrapped) return false;
        window.renderTaskCard = function renderTaskCardComTempoLiquido(t, dia, idx, atrasada) {
            const realIdx = atrasada ? taskIndex(dia, t, idx) : idx;
            const timerId = safeId(`${dia}-${realIdx}-${t?.itemId || t?.id || t?.a || idx}`);
            const checkAction = atrasada ? `cliqueTask('${jsString(dia)}', ${realIdx})` : `cliqueTask('${jsString(dia)}', ${idx})`;
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
                    <button class="btn btn-sm btn-outline" id="btn-t-${timerId}" onclick="toggleTimer('${timerId}', '${jsString(dia)}', ${realIdx})"><i class="fas fa-play"></i></button>
                    <span id="time-${timerId}" style="font-family:monospace; font-weight:800; color:var(--accent);">00:00</span>
                </div>
            </div>
            <input type="checkbox" ${t.c ? 'checked' : ''} onclick="${checkAction}">
        </div>`;
        };
        window.renderTaskCard.__plantaoScheduleHardeningWrapped = true;
        return true;
    }

    function registerNetTime(day, idx, seconds) {
        const db = dbRef();
        const task = db?.metaFixa?.[day]?.[idx];
        if(!db || !task || seconds < TIMER_MIN_SECONDS) return false;
        const minutes = Math.round(seconds / 60);
        task.tempoLiquidoSegundos = Math.max(0, Math.round((task.tempoLiquidoSegundos || 0) + seconds));
        db.tempoLiquido = Array.isArray(db.tempoLiquido) ? db.tempoLiquido : [];
        db.tempoLiquido.push({
            id: `timer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            dia: day,
            itemId: task.itemId || task.id || '',
            materia: task.m || '',
            assunto: task.a || '',
            tipo: task.k || '',
            planejadoHoras: parseFloat(task.h) || 0,
            segundos: Math.round(seconds),
            minutos,
            createdAt: new Date().toISOString(),
            source: 'timer'
        });
        db.tempoLiquido = db.tempoLiquido.slice(-600);
        try {
            const save = globalValue('save');
            if(typeof save === 'function') save();
            else localStorage.setItem('prf_v120', JSON.stringify(db));
        } catch(_) {}
        return true;
    }

    function wrapTimer() {
        window.toggleTimer = function toggleTimerLiquido(id, day, idx) {
            const button = document.getElementById(`btn-t-${id}`);
            const display = document.getElementById(`time-${id}`);
            if(!display) return;
            if(activeTimers[id]) {
                clearInterval(activeTimers[id].interval);
                const elapsed = Math.max(0, Math.round((Date.now() - activeTimers[id].startedAt) / 1000));
                const accumulated = (activeTimers[id].baseSeconds || 0) + elapsed;
                registerNetTime(day, Number(idx), Math.max(0, accumulated - (activeTimers[id].savedSeconds || 0)));
                delete activeTimers[id];
                if(button) button.innerHTML = '<i class="fas fa-play"></i>';
                return;
            }
            const parts = String(display.innerText || '00:00').split(':').map(n => parseInt(n, 10) || 0);
            const baseSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
            activeTimers[id] = {
                day,
                idx: Number(idx),
                baseSeconds,
                savedSeconds: baseSeconds,
                startedAt: Date.now(),
                interval: setInterval(() => {
                    const total = baseSeconds + Math.max(0, Math.round((Date.now() - activeTimers[id].startedAt) / 1000));
                    display.innerText = `${Math.floor(total/60).toString().padStart(2,'0')}:${(total%60).toString().padStart(2,'0')}`;
                }, 1000)
            };
            if(button) button.innerHTML = '<i class="fas fa-pause"></i>';
        };
    }

    function persistOpenTimers() {
        Object.keys(activeTimers).forEach(id => {
            const timer = activeTimers[id];
            clearInterval(timer.interval);
            const elapsed = Math.max(0, Math.round((Date.now() - timer.startedAt) / 1000));
            registerNetTime(timer.day, timer.idx, elapsed);
            delete activeTimers[id];
        });
    }

    function install() {
        installDateApi();
        wrapNormalizer();
        wrapDelayCollectors();
        wrapTaskRenderer();
        wrapTimer();
        normalizeDbDates();
        window.__plantaoScheduleHardeningVersion = VERSION;
        try {
            const daily = document.getElementById('diaria');
            const renderDiario = globalValue('renderDiario');
            const vDate = globalValue('vDate') || new Date();
            if(daily?.classList.contains('active') && typeof renderDiario === 'function') renderDiario(vDate);
        } catch(_) {}
    }

    window.addEventListener('beforeunload', persistOpenTimers);
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();

    const retry = setInterval(() => {
        const ok = wrapNormalizer() && wrapTaskRenderer();
        if(ok) clearInterval(retry);
    }, 250);
    setTimeout(() => clearInterval(retry), 6000);
})();
