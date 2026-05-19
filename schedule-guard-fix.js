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

    function validDateKey(key) {
        const d = dateFromKey(key);
        return d instanceof Date && !Number.isNaN(d.getTime());
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
            copy.h = Math.max(0.1, Math.round((parseFloat(copy.h) || 0.5) * 10) / 10);
            return copy;
        }

        const item = findItem(task);
        if(!item) {
            report.removed += 1;
            return null;
        }

        const type = ['E', 'Rev', 'Ex'].includes(task.k) ? task.k : 'E';
        const labels = { E: 'Estudo', Rev: 'Revisao', Ex: 'Exercicios' };
        const copy = {...task};
        copy.itemId = item.id;
        copy.m = String(item.m || copy.m || '').trim().toUpperCase();
        copy.a = String(item.a || copy.a || '').trim();
        copy.k = type;
        copy.l = String(copy.l || labels[type]).trim();
        copy.data = copy.data || key;
        copy.h = Math.max(0.1, Math.round((parseFloat(copy.h) || (type === 'E' ? parseFloat(item.h?.E) || 1 : 1)) * 10) / 10);
        copy.c = copy.c === true;
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
            const key = `${task.itemId || task.m + task.a}:${task.k}`;
            const existing = seen.get(key);
            if(!existing) {
                seen.set(key, task);
                out.push(task);
                return;
            }
            report.duplicates += 1;
            existing.c = existing.c || task.c;
            existing.perf = existing.perf || task.perf || null;
            if(task.recoveryId && !existing.recoveryId) existing.recoveryId = task.recoveryId;
            if(task.recuperado) existing.recuperado = true;
            if(task.k === 'E' || task.k === 'Rev') {
                existing.h = Math.round(((parseFloat(existing.h) || 0) + (parseFloat(task.h) || 0)) * 10) / 10;
            } else {
                existing.h = Math.max(parseFloat(existing.h) || 0, parseFloat(task.h) || 0, 1);
            }
        });
        return out;
    }

    function enforceFutureLimit(key, tasks, report) {
        if(!isTodayOrFuture(key)) return tasks;
        const limit = dayLimit(key);
        const extras = tasks.filter(extraTask);
        const planned = tasks.filter(task => !extraTask(task));
        if(limit <= 0) {
            const kept = [...planned.filter(task => task.c), ...extras];
            report.trimmed += tasks.length - kept.length;
            return kept;
        }

        const kept = [];
        let total = 0;
        planned.filter(task => task.c).forEach(task => {
            kept.push(task);
            total += parseFloat(task.h) || 0;
        });

        for(const task of planned.filter(task => !task.c)) {
            const h = parseFloat(task.h) || 0;
            const remaining = Math.max(0, limit - total);
            if(remaining <= 0.01) {
                report.trimmed += 1;
                continue;
            }
            if(h <= remaining + 0.01) {
                kept.push(task);
                total += h;
                continue;
            }
            if(task.k === 'E' && remaining >= 0.5) {
                kept.push({...task, h: Math.round(remaining * 10) / 10});
                total += remaining;
                report.trimmed += 1;
                continue;
            }
            report.trimmed += 1;
        }
        return [...kept, ...extras];
    }

    function repairSchedule(options = {}) {
        if(repairing || typeof db === 'undefined' || !db) return lastReport;
        repairing = true;
        const report = { changed: false, invalidDays: 0, removed: 0, duplicates: 0, trimmed: 0 };
        try {
            if(!db.metaFixa || typeof db.metaFixa !== 'object' || Array.isArray(db.metaFixa)) {
                db.metaFixa = {};
                report.changed = true;
            }
            if(!Array.isArray(db.lista)) db.lista = [];
            if(!Array.isArray(db.ciclo)) db.ciclo = [];

            Object.keys(db.metaFixa || {}).forEach(key => {
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

                if(JSON.stringify(original) !== JSON.stringify(limited)) report.changed = true;
            });

            db.ciclo = [...new Set(db.ciclo.map(m => String(m || '').trim().toUpperCase()))]
                .filter(m => db.lista.some(item => item.m === m));

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
        repairSchedule();
        return typeof save === 'function' && typeof renderSemanal === 'function';
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
    const timer = setInterval(() => {
        if(install()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 10000);
})();