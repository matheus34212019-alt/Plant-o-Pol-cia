(function plantaoLaunchFix() {
    if (window.__plantaoLaunchFixV196) return;
    window.__plantaoLaunchFixV196 = true;

    const DAY_REPAIR_DELAY = [60, 400, 1200];

    function extra(task) {
        return task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    }

    function planned(tasks) {
        if (typeof tarefasPlanejadas === 'function') return tarefasPlanejadas(tasks || []);
        return (tasks || []).filter((task) => !extra(task));
    }

    function norm(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function roundHour(value) {
        return Math.round((parseFloat(value) || 0) * 10) / 10;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value || null));
    }

    function sameTask(a, b) {
        if (typeof mesmaTarefaPlanejada === 'function') return mesmaTarefaPlanejada(a, b);
        if (a?.recoveryId && b?.recoveryId && a.recoveryId === b.recoveryId) return true;
        if (a?.itemId && b?.itemId && a.itemId === b.itemId && a.k === b.k) return true;
        return norm(a?.m) === norm(b?.m) && norm(a?.a) === norm(b?.a) && a?.k === b?.k;
    }

    function taskSig(task) {
        return encodeURIComponent(JSON.stringify([
            task?.recoveryId || '',
            task?.itemId || '',
            task?.k || '',
            task?.m || '',
            task?.a || '',
            task?.l || '',
            roundHour(task?.h),
            task?.data || '',
        ]));
    }

    function todayKey() {
        return typeof dateKey === 'function' ? dateKey(new Date()) : null;
    }

    function shadowKey() {
        const user = (typeof emailUsuario === 'function' && emailUsuario()) || window.cloudUser?.email || 'local';
        return `plantao_lancamentos_shadow_v196_${norm(user) || 'local'}`;
    }

    function readShadow() {
        try {
            return JSON.parse(localStorage.getItem(shadowKey()) || '[]');
        } catch (e) {
            return [];
        }
    }

    function writeShadow(records) {
        try {
            localStorage.setItem(shadowKey(), JSON.stringify(records || []));
        } catch (e) {}
    }

    function launchKey(day, task) {
        return [
            day || task?.data || '',
            task?.__launchId || task?.recoveryId || '',
            task?.itemId || '',
            task?.k || '',
            norm(task?.m),
            norm(task?.a),
            roundHour(task?.h),
        ].join('|');
    }

    function ensureHistory() {
        if (!db || typeof db !== 'object') return [];
        db.lancamentos = Array.isArray(db.lancamentos) ? db.lancamentos : [];
        const merged = new Map();
        [...readShadow(), ...db.lancamentos].forEach((record) => {
            if (!record?.task) return;
            merged.set(record.id || launchKey(record.dia, record.task), record);
        });
        db.lancamentos = Array.from(merged.values());
        writeShadow(db.lancamentos);
        return db.lancamentos;
    }

    function recordLaunch(day, task) {
        if (!day || !task?.c || extra(task)) return;
        ensureHistory();
        if (!task.__launchId) task.__launchId = `lan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const record = {
            id: task.__launchId,
            dia: day,
            createdAt: task.__launchCreatedAt || new Date().toISOString(),
            task: { ...task, c: true, data: day },
        };
        task.__launchCreatedAt = record.createdAt;
        const key = launchKey(day, task);
        const idx = db.lancamentos.findIndex((item) => item.id === record.id || launchKey(item.dia, item.task) === key);
        if (idx >= 0) db.lancamentos[idx] = { ...db.lancamentos[idx], ...record };
        else db.lancamentos.push(record);
        writeShadow(db.lancamentos);
    }

    function seedHistory() {
        Object.entries(db?.metaFixa || {}).forEach(([day, tasks]) => {
            (tasks || []).forEach((task) => {
                if (task?.c && !extra(task)) recordLaunch(day, task);
            });
        });
    }

    function currentLaunches() {
        const out = [];
        const seen = new Set();
        ensureHistory().forEach((record) => {
            if (!record?.task) return;
            const id = record.id || launchKey(record.dia, record.task);
            if (seen.has(id)) return;
            seen.add(id);
            out.push({ dia: record.dia, idx: -1, task: { ...record.task, c: true }, historicoId: id, createdAt: record.createdAt });
        });
        Object.entries(db?.metaFixa || {}).forEach(([day, tasks]) => {
            (tasks || []).forEach((task, idx) => {
                if (!task?.c || extra(task)) return;
                const id = task.__launchId || launchKey(day, task);
                if (seen.has(id)) return;
                seen.add(id);
                out.push({ dia: day, idx, task });
            });
        });
        return out.sort((a, b) => keyToDate(b.dia) - keyToDate(a.dia) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    function buildReplacementTasks(day, completedTasks, targetHours, excludedMaterials) {
        if (!day || targetHours <= 0.01 || typeof getNeuralPoolSim !== 'function' || typeof keyToDate !== 'function') return [];
        const excluded = new Set(Array.from(excludedMaterials || []).map(norm).filter(Boolean));
        (completedTasks || []).forEach((task) => excluded.add(norm(task.m)));

        const simDb = clone(db);
        if (!simDb) return [];
        simDb.metaFixa = simDb.metaFixa || {};
        simDb.metaFixa[day] = [];
        simDb.ciclo = Array.isArray(simDb.ciclo) ? simDb.ciclo.filter((mat) => !excluded.has(norm(mat))) : [];
        (completedTasks || []).forEach((task) => {
            if (typeof concluirTaskNoState === 'function' && !extra(task)) concluirTaskNoState({ ...task, c: false }, day, simDb);
        });

        const generated = planned(getNeuralPoolSim(targetHours, simDb, keyToDate(day)) || []);
        const out = [];
        let total = 0;
        generated.forEach((task) => {
            const mat = norm(task.m);
            if (!mat || excluded.has(mat) || out.some((item) => norm(item.m) === mat)) return;
            if ((completedTasks || []).some((done) => sameTask(done, task))) return;
            const free = roundHour(targetHours - total);
            const hours = roundHour(Math.min(parseFloat(task.h) || 0, free));
            if (hours <= 0.01) return;
            out.push({ ...task, h: hours, c: false, data: day });
            total = roundHour(total + hours);
        });
        return out;
    }

    function splitStudyForOneHour(day, idx) {
        const tasks = db?.metaFixa?.[day];
        const task = tasks?.[idx];
        if (!task || task.c || task.k !== 'E') return idx;
        const hours = roundHour(task.h);
        if (hours <= 1.01) return idx;

        const done = { ...task, h: 1, c: false, data: day, __plantaoParcialEstudo: true };
        const remaining = roundHour(hours - 1);
        const fallback = { ...task, h: remaining, c: false, data: day, __plantaoRestoEstudo: true };
        const replacements = buildReplacementTasks(day, [{ ...done, c: true }], remaining, new Set([task.m]));
        delete done.perf;
        delete fallback.perf;
        tasks.splice(idx, 1, done, ...(replacements.length ? replacements : [fallback]));
        if (typeof atualizarPlanoDiaTravado === 'function') atualizarPlanoDiaTravado(day);
        return idx;
    }

    function repairInflated(day) {
        const tasks = db?.metaFixa?.[day];
        if (!Array.isArray(tasks)) return false;
        let changed = false;
        for (let idx = tasks.length - 1; idx >= 0; idx--) {
            const task = tasks[idx];
            const hours = roundHour(task?.h);
            if (!task?.c || task.k !== 'E' || extra(task) || hours <= 1.01) continue;
            const done = { ...task, h: 1, c: true, data: day, __plantaoParcialCorrigido: true };
            const remaining = roundHour(hours - 1);
            const fallback = { ...task, h: remaining, c: false, data: day, __plantaoRestoCorrigido: true };
            const replacements = buildReplacementTasks(day, [done], remaining, new Set([task.m]));
            delete fallback.perf;
            tasks.splice(idx, 1, done, ...(remaining > 0.01 ? (replacements.length ? replacements : [fallback]) : []));
            recordLaunch(day, done);
            changed = true;
        }
        return changed;
    }

    function repairRepeatedRemainder(day) {
        const tasks = db?.metaFixa?.[day];
        if (!Array.isArray(tasks)) return false;
        const completed = tasks.filter((task) => task?.c && task.k === 'E' && !extra(task));
        if (!completed.length) return false;
        let changed = false;
        for (let idx = tasks.length - 1; idx >= 0; idx--) {
            const task = tasks[idx];
            if (!task || task.c || task.k !== 'E' || extra(task)) continue;
            const repeated = completed.some((done) => done.itemId === task.itemId || norm(done.m) === norm(task.m));
            if (!repeated) continue;
            const replacements = buildReplacementTasks(day, completed, roundHour(task.h), new Set(completed.map((done) => done.m)));
            if (!replacements.length) continue;
            tasks.splice(idx, 1, ...replacements);
            changed = true;
        }
        return changed;
    }

    function repairToday(options = {}) {
        const day = todayKey();
        if (!day) return;
        seedHistory();
        const changed = repairInflated(day) || repairRepeatedRemainder(day);
        if (!changed) return;
        if (typeof atualizarPlanoDiaTravado === 'function') atualizarPlanoDiaTravado(day);
        if (typeof save === 'function') save();
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderDiarioSemRecalcular === 'function' && typeof vDate !== 'undefined') renderDiarioSemRecalcular(vDate);
        if (typeof renderSemanal === 'function') renderSemanal();
        if (options.toast && typeof showToast === 'function') {
            showToast('Cronograma corrigido', 'Mantive 1h marcada e recompus o restante com outras atividades.');
        }
    }

    function installHistory() {
        if (window.__plantaoLaunchHistoryInstalledV196) return;
        window.__plantaoLaunchHistoryInstalledV196 = true;
        ensureHistory();
        seedHistory();

        if (typeof concluirTask === 'function' && !concluirTask.__launchHistoryV196) {
            const original = concluirTask;
            concluirTask = function concluirTaskComHistorico(task, day) {
                const result = original.apply(this, arguments);
                if (result !== false && task?.c) recordLaunch(day, task);
                return result;
            };
            concluirTask.__launchHistoryV196 = true;
        }

        listarLancamentos = function listarLancamentosComHistorico() {
            return currentLaunches();
        };

        window.removerLancamentoSeguro = function removerLancamentoSeguro(id, day, idx) {
            ensureHistory();
            db.lancamentos = db.lancamentos.filter((record) => record.id !== id);
            writeShadow(db.lancamentos);
            if (idx >= 0 && db.metaFixa?.[day]?.[idx]) {
                db.metaFixa[day][idx].c = false;
                db.metaFixa[day][idx].perf = null;
                if (typeof reconstruirProgressoPorLancamentos === 'function') reconstruirProgressoPorLancamentos();
            }
            if (typeof save === 'function') save();
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof renderLancamentos === 'function') renderLancamentos();
        };

        renderLancamentos = function renderLancamentosComHistorico() {
            const target = document.getElementById('lancamentos-content');
            if (!target) return;
            const launches = currentLaunches();
            if (!launches.length) {
                target.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-database"></i>
                        <strong>Nenhum lancamento registrado</strong>
                        <span>Quando voce marcar uma atividade como feita, ela aparecera aqui.</span>
                    </div>`;
                return;
            }
            target.innerHTML = `
                <div class="lancamentos-list">
                    ${launches.map(({ dia, idx, task, historicoId }) => {
                        const id = historicoId || task.__launchId || launchKey(dia, task);
                        return `
                            <div class="lancamento-row">
                                <div class="lancamento-date">
                                    <strong>${dia.slice(0, 5)}</strong>
                                    <span>${dia}</span>
                                </div>
                                <div class="lancamento-main">
                                    <span class="tag tag-${task.k === 'Ex' ? 'ex' : (task.k === 'Rev' ? 'rev' : 'e')}">${task.l}</span>
                                    <b>${task.m}</b>
                                    <small>${task.a}</small>
                                </div>
                                <div class="lancamento-hours">${(parseFloat(task.h) || 0).toFixed(1)}h</div>
                                <button class="btn btn-sm btn-outline danger-btn" onclick="removerLancamentoSeguro('${id}', '${dia}', ${idx})">
                                    <i class="fas fa-trash"></i> REMOVER
                                </button>
                            </div>`;
                    }).join('')}
                </div>`;
        };
    }

    function installSafeClick() {
        if (window.__plantaoLaunchSafeClickV196 || typeof cliqueTask !== 'function') return;
        window.__plantaoLaunchSafeClickV196 = true;
        window.cliqueTaskSeguro = function cliqueTaskSeguro(event, day, signature, fallbackIdx) {
            if (event?.stopPropagation) event.stopPropagation();
            const tasks = db?.metaFixa?.[day] || [];
            const idx = tasks.findIndex((task) => taskSig(task) === signature);
            let target = idx >= 0 ? idx : (Number.isFinite(Number(fallbackIdx)) ? Number(fallbackIdx) : -1);
            if (target < 0 || !tasks[target]) {
                if (typeof renderDiarioSemRecalcular === 'function') renderDiarioSemRecalcular(vDate);
                return false;
            }
            target = splitStudyForOneHour(day, target);
            return cliqueTask(day, target);
        };
    }

    function boot() {
        installHistory();
        installSafeClick();
        DAY_REPAIR_DELAY.forEach((delay, idx) => setTimeout(() => repairToday({ toast: idx === 0 }), delay));
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    boot();
    setTimeout(boot, 800);
})();
