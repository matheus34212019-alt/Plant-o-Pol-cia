(function plantaoScheduleGuardFix() {
    if(window.__plantaoScheduleGuardFixInstalled) return;
    window.__plantaoScheduleGuardFixInstalled = true;

    let repairing = false;
    let lastReport = null;

    function clone(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function safeTasks(value) {
        return Array.isArray(value) ? value : [];
    }

    function roundHour(value) {
        return Math.round((parseFloat(value) || 0) * 10) / 10;
    }

    function extraTask(task) {
        try {
            if(typeof isExtraTask === 'function') return isExtraTask(task);
        } catch(e) {}
        return task?.extra === true || task?.l === 'Extra';
    }

    function dateFromKey(key) {
        try {
            if(typeof keyToDate === 'function') return keyToDate(key);
        } catch(e) {}
        const parts = String(key || '').split('/').map(Number);
        if(parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
        return parts[2] > 31 ? new Date(parts[2], parts[1] - 1, parts[0]) : null;
    }

    function keyFromDate(date) {
        try {
            if(typeof dateKey === 'function') return dateKey(date);
        } catch(e) {}
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${date.getFullYear()}`;
    }

    function addDaysSafe(date, days) {
        try {
            if(typeof addDays === 'function') return addDays(date, days);
        } catch(e) {}
        const copy = new Date(date);
        copy.setDate(copy.getDate() + days);
        return copy;
    }

    function validDateKey(key) {
        const d = dateFromKey(key);
        return d instanceof Date && !Number.isNaN(d.getTime());
    }

    function compareDateKeys(a, b) {
        const da = dateFromKey(a);
        const dbb = dateFromKey(b);
        return (da?.getTime?.() || 0) - (dbb?.getTime?.() || 0);
    }

    function dayLimit(key) {
        const d = dateFromKey(key);
        if(!d || !db?.h) return 0;
        return Math.max(0, parseFloat(db.h[d.getDay()]) || 0);
    }

    function todayStart() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function isTodayOrFuture(key) {
        const d = dateFromKey(key);
        if(!d) return false;
        d.setHours(0, 0, 0, 0);
        return d >= todayStart();
    }

    function pausedDay(key) {
        try {
            if(typeof diaPausado === 'function') return diaPausado(key);
        } catch(e) {}
        return Array.isArray(db?.diasPausados) && db.diasPausados.includes(key);
    }

    function plannedHours(tasks) {
        return safeTasks(tasks)
            .filter(task => !extraTask(task))
            .reduce((acc, task) => acc + (parseFloat(task?.h) || 0), 0);
    }

    function sameTask(a, b) {
        if(a?.itemId && b?.itemId && a.itemId === b.itemId && a?.k === b?.k) return true;
        const am = String(a?.m || '').trim().toUpperCase();
        const bm = String(b?.m || '').trim().toUpperCase();
        const aa = String(a?.a || '').trim();
        const ba = String(b?.a || '').trim();
        return am === bm && aa === ba && a?.k === b?.k;
    }

    function findItem(task) {
        const list = Array.isArray(db?.lista) ? db.lista : [];
        if(task?.itemId) {
            const byId = list.find(item => item.id === task.itemId);
            if(byId) return byId;
        }
        const mat = String(task?.m || '').trim().toUpperCase();
        const ass = String(task?.a || '').trim();
        return list.find(item => String(item.m || '').trim().toUpperCase() === mat && String(item.a || '').trim() === ass) || null;
    }

    function normalizeTask(task, key, report) {
        if(!task || typeof task !== 'object') {
            report.removed += 1;
            return null;
        }

        if(extraTask(task)) {
            const copy = {...task, extra: true};
            copy.m = String(copy.m || 'EXTRA').trim().toUpperCase();
            copy.a = String(copy.a || 'Atividade extra').trim();
            copy.l = 'Extra';
            copy.h = Math.max(0.1, roundHour(copy.h || 0.5));
            copy.data = copy.data || key;
            return copy;
        }

        const item = findItem(task);
        const type = ['E', 'Rev', 'Ex'].includes(task.k) ? task.k : 'E';
        const labels = { E: 'Estudo', Rev: 'Revisao', Ex: 'Exercicios' };
        const copy = {...task};

        if(item) {
            copy.itemId = item.id;
            copy.m = String(item.m || copy.m || '').trim().toUpperCase();
            copy.a = String(item.a || copy.a || '').trim();
            delete copy.guardOrphan;
        } else {
            const mat = String(copy.m || '').trim().toUpperCase();
            const ass = String(copy.a || '').trim();
            if(!mat && !ass) {
                report.removed += 1;
                return null;
            }
            copy.m = mat || 'SEM MATERIA';
            copy.a = ass || 'Atividade sem assunto';
            delete copy.itemId;
            copy.guardOrphan = true;
            report.orphans += 1;
        }

        copy.k = type;
        copy.l = String(copy.l || labels[type]).trim();
        copy.data = key;
        copy.h = Math.max(0.1, roundHour(copy.h || (item && type === 'E' ? parseFloat(item.h?.E) || 1 : 1)));
        copy.c = copy.c === true;
        if(copy.guardCarry === true) copy.guardCarry = true;
        else delete copy.guardCarry;
        return copy;
    }

    function compactDay(tasks, report) {
        const out = [];
        const seen = new Map();
        tasks.forEach(task => {
            if(extraTask(task)) {
                out.push(task);
                return;
            }
            const key = `${task.itemId || String(task.m || '').toUpperCase() + String(task.a || '')}:${task.k}`;
            const existing = seen.get(key);
            if(!existing) {
                seen.set(key, task);
                out.push(task);
                return;
            }
            report.duplicates += 1;
            existing.c = existing.c || task.c;
            existing.perf = existing.perf || task.perf || null;
            existing.guardCarry = existing.guardCarry || task.guardCarry;
            existing.guardOrphan = existing.guardOrphan || task.guardOrphan;
            if(task.recoveryId && !existing.recoveryId) existing.recoveryId = task.recoveryId;
            if(task.recuperado) existing.recuperado = true;
            if(task.k === 'E' || task.k === 'Rev') {
                existing.h = roundHour((parseFloat(existing.h) || 0) + (parseFloat(task.h) || 0));
            } else {
                existing.h = Math.max(parseFloat(existing.h) || 0, parseFloat(task.h) || 0, 1);
            }
        });
        return out;
    }

    function queueOverflow(report, sourceKey, task) {
        if(!task || task.c || extraTask(task)) return;
        const copy = clone(task);
        copy.c = false;
        report._overflow.push({ sourceKey, task: copy });
        report.overflowed += 1;
    }

    function enforceFutureLimit(key, tasks, report) {
        if(!isTodayOrFuture(key)) return tasks;
        const limit = dayLimit(key);
        const extras = tasks.filter(extraTask);
        const planned = tasks.filter(task => !extraTask(task));
        const completed = planned.filter(task => task.c);
        const pending = planned.filter(task => !task.c);

        if(limit <= 0) {
            pending.forEach(task => queueOverflow(report, key, task));
            return [...completed, ...extras];
        }

        const kept = [];
        let total = 0;
        completed.forEach(task => {
            kept.push(task);
            total += parseFloat(task.h) || 0;
        });

        pending.forEach(task => {
            const h = parseFloat(task.h) || 0;
            const remaining = Math.max(0, limit - total);
            if(remaining <= 0.01) {
                queueOverflow(report, key, task);
                return;
            }
            if(h <= remaining + 0.01) {
                kept.push(task);
                total += h;
                return;
            }
            if(task.k === 'E' && remaining >= 0.5) {
                const block = roundHour(remaining);
                kept.push({...task, h: block, guardCarry: false});
                total += block;
                const rest = roundHour(h - block);
                if(rest > 0.01) queueOverflow(report, key, {...task, h: rest});
                return;
            }
            queueOverflow(report, key, task);
        });

        return [...kept, ...extras];
    }

    function placeTaskOnDay(key, task) {
        if(pausedDay(key)) return null;
        const limit = dayLimit(key);
        if(limit <= 0) return null;
        const tasks = safeTasks(db.metaFixa?.[key]);
        const free = Math.max(0, limit - plannedHours(tasks));
        if(free <= 0.01) return null;

        const h = parseFloat(task.h) || 0;
        let placedHours = h;
        if(h > free + 0.01) {
            if(task.k !== 'E' || free < 0.5) return null;
            placedHours = roundHour(free);
        }
        if(placedHours <= 0.01) return null;

        const placed = {...task, data: key, h: placedHours, c: false, guardCarry: false};
        delete placed.guardCarry;
        const target = [...tasks];
        const mergeable = target.find(existing => !existing.c && !extraTask(existing) && sameTask(existing, placed) && (placed.k === 'E' || placed.k === 'Rev'));
        if(mergeable) {
            mergeable.h = roundHour((parseFloat(mergeable.h) || 0) + placedHours);
            mergeable.guardOrphan = mergeable.guardOrphan || placed.guardOrphan;
        } else {
            target.push(placed);
        }
        db.metaFixa[key] = target;
        return { remaining: roundHour(h - placedHours) };
    }

    function touchLockedPlan(key) {
        try {
            if(typeof atualizarPlanoDiaTravado === 'function') atualizarPlanoDiaTravado(key);
        } catch(e) {}
    }

    function preserveUnplaced(sourceKey, task, report) {
        const fallback = {...task, data: sourceKey, c: false, guardCarry: true};
        db.metaFixa[sourceKey] = safeTasks(db.metaFixa?.[sourceKey]);
        const exists = db.metaFixa[sourceKey].some(existing => sameTask(existing, fallback) && roundHour(existing.h) === roundHour(fallback.h) && existing.guardCarry);
        if(!exists) db.metaFixa[sourceKey].push(fallback);
        report.deferred += 1;
        report.changed = true;
        touchLockedPlan(sourceKey);
    }

    function redistributeOverflow(report) {
        const overflow = report._overflow || [];
        overflow.forEach(entry => {
            let task = clone(entry.task);
            let remainingHours = parseFloat(task.h) || 0;
            const sourceDate = dateFromKey(entry.sourceKey) || todayStart();

            for(let offset = 1; remainingHours > 0.01 && offset <= 730; offset++) {
                const date = addDaysSafe(sourceDate, offset);
                const key = keyFromDate(date);
                if(!validDateKey(key)) continue;
                task.h = roundHour(remainingHours);
                const placed = placeTaskOnDay(key, task);
                if(!placed) continue;
                report.moved += 1;
                report.changed = true;
                remainingHours = placed.remaining;
                touchLockedPlan(key);
            }

            if(remainingHours > 0.01) {
                task.h = roundHour(remainingHours);
                preserveUnplaced(entry.sourceKey, task, report);
            }
        });
    }

    function repairSchedule() {
        if(repairing || typeof db === 'undefined' || !db) return lastReport;
        repairing = true;
        const report = {
            changed: false,
            invalidDays: 0,
            removed: 0,
            duplicates: 0,
            overflowed: 0,
            moved: 0,
            deferred: 0,
            orphans: 0,
            _overflow: []
        };
        try {
            if(!db.metaFixa || typeof db.metaFixa !== 'object' || Array.isArray(db.metaFixa)) {
                db.metaFixa = {};
                report.changed = true;
            }
            if(!Array.isArray(db.lista)) db.lista = [];
            if(!Array.isArray(db.ciclo)) db.ciclo = [];

            Object.keys(db.metaFixa || {}).sort(compareDateKeys).forEach(key => {
                if(!validDateKey(key)) {
                    delete db.metaFixa[key];
                    report.invalidDays += 1;
                    report.changed = true;
                    return;
                }

                const original = safeTasks(db.metaFixa[key]);
                const normalized = original
                    .map(task => normalizeTask(task, key, report))
                    .filter(Boolean);
                const compacted = compactDay(normalized, report);
                const limited = enforceFutureLimit(key, compacted, report);

                if(limited.length) db.metaFixa[key] = limited;
                else delete db.metaFixa[key];

                if(JSON.stringify(original) !== JSON.stringify(limited)) {
                    report.changed = true;
                    touchLockedPlan(key);
                }
            });

            redistributeOverflow(report);

            const cleanedCycle = [...new Set(db.ciclo.map(m => String(m || '').trim().toUpperCase()).filter(Boolean))];
            const nextCycle = db.lista.length
                ? cleanedCycle.filter(m => db.lista.some(item => String(item.m || '').trim().toUpperCase() === m))
                : cleanedCycle;
            if(JSON.stringify(db.ciclo) !== JSON.stringify(nextCycle)) {
                db.ciclo = nextCycle;
                report.changed = true;
            }

            delete report._overflow;
            lastReport = report;
            return report;
        } finally {
            repairing = false;
        }
    }

    function notifyIfNeeded(report) {
        if(!report?.changed || report.__notified) return;
        report.__notified = true;
        try {
            console.info('[PLANTAO] Cronograma verificado', report);
        } catch(e) {}
    }

    function wrap() {
        if(typeof save === 'function' && !save.__plantaoScheduleGuardWrapped) {
            const originalSave = save;
            save = function saveWithScheduleGuard() {
                const report = repairSchedule();
                notifyIfNeeded(report);
                return originalSave.apply(this, arguments);
            };
            save.__plantaoScheduleGuardWrapped = true;
        }

        ['renderSemanal', 'renderDiario', 'renderReplanejar'].forEach(name => {
            const fn = window[name];
            if(typeof fn !== 'function' || fn.__plantaoScheduleGuardWrapped) return;
            window[name] = function renderWithScheduleGuard() {
                repairSchedule();
                return fn.apply(this, arguments);
            };
            window[name].__plantaoScheduleGuardWrapped = true;
        });

        ['replanejarAgora', 'replanejarComecarAmanha', 'impEdital', 'saveC', 'saveH'].forEach(name => {
            const fn = window[name];
            if(typeof fn !== 'function' || fn.__plantaoScheduleGuardWrapped) return;
            window[name] = function actionWithScheduleGuard() {
                const result = fn.apply(this, arguments);
                setTimeout(() => {
                    const report = repairSchedule();
                    notifyIfNeeded(report);
                    try { if(report?.changed && typeof save === 'function') save(); } catch(e) {}
                }, 0);
                return result;
            };
            window[name].__plantaoScheduleGuardWrapped = true;
        });
    }

    window.__plantaoRepairSchedule = repairSchedule;
    window.__plantaoScheduleGuardReport = () => lastReport || repairSchedule();

    function install() {
        wrap();
        const report = repairSchedule();
        if(report?.changed && typeof save === 'function') {
            setTimeout(() => {
                try { save(); } catch(e) {}
            }, 0);
        }
        return typeof save === 'function' && typeof renderSemanal === 'function';
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
    const timer = setInterval(() => {
        if(install()) clearInterval(timer);
    }, 500);
    setTimeout(() => clearInterval(timer), 10000);
})();