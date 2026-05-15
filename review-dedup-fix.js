(function reviewDedupFix() {
    if(window.__plantaoReviewDedupFixLoaded) return;
    window.__plantaoReviewDedupFixLoaded = true;

    function isExtra(task) {
        return task && (task.extra === true || task.l === 'Extra' || task.k === 'Extra');
    }

    function isReview(task) {
        return task && task.k === 'Rev' && !isExtra(task);
    }

    function isExercise(task) {
        return task && task.k === 'Ex' && !isExtra(task);
    }

    function isLocked(task) {
        return isExtra(task) || task?.c;
    }

    function toDate(key) {
        if(typeof keyToDate === 'function') return keyToDate(key);
        const parts = String(key || '').split('/').map(Number);
        return new Date(parts[2] || 1970, (parts[1] || 1) - 1, parts[0] || 1);
    }

    function toKey(date) {
        if(typeof dateKey === 'function') return dateKey(date);
        return date.toLocaleDateString();
    }

    function normalize(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function cycleKey(task) {
        const match = String(task?.l || '').match(/ciclo\s*0*(\d+)/i);
        return match ? `c${match[1]}` : 'inicial';
    }

    function subjectKey(task) {
        if(task?.itemId) return `id:${task.itemId}|${cycleKey(task)}`;
        return `txt:${normalize(task?.m)}|${normalize(task?.a)}|${cycleKey(task)}`;
    }

    function dedupePlanMap(plans) {
        const output = {};
        const completedByExercise = new Set();
        let changed = false;

        Object.keys(plans || {})
            .sort((a, b) => toDate(a) - toDate(b))
            .forEach(dayKey => {
                const kept = [];
                (plans[dayKey] || []).forEach(task => {
                    const key = subjectKey(task);
                    if(isReview(task) && !isLocked(task) && completedByExercise.has(key)) {
                        changed = true;
                        return;
                    }
                    kept.push(task);
                    if(isExercise(task)) completedByExercise.add(key);
                });
                if(kept.length) output[dayKey] = kept;
                else if((plans[dayKey] || []).length) changed = true;
            });

        return { plans: output, changed };
    }

    function dedupeFixedFrom(startKey) {
        if(!window.db?.metaFixa) return false;
        const future = {};
        Object.keys(db.metaFixa).forEach(key => {
            if(toDate(key) >= toDate(startKey)) future[key] = db.metaFixa[key];
        });

        const { plans, changed } = dedupePlanMap(future);
        if(!changed) return false;

        const allKeys = new Set([...Object.keys(future), ...Object.keys(plans)]);
        allKeys.forEach(key => {
            if(plans[key]?.length) db.metaFixa[key] = plans[key];
            else delete db.metaFixa[key];
            if(typeof atualizarPlanoDiaTravado === 'function') atualizarPlanoDiaTravado(key);
        });
        return true;
    }

    function install() {
        if(typeof calcularSemanaPlanejada !== 'function') return false;
        if(!calcularSemanaPlanejada.__plantaoExerciseGuard) return false;
        if(calcularSemanaPlanejada.__plantaoReviewDedupFix) return true;

        const originalCalcular = calcularSemanaPlanejada;
        calcularSemanaPlanejada = function calcularSemanaSemRevisaoDuplicadaDepoisDoExercicio() {
            return dedupePlanMap(originalCalcular.apply(this, arguments)).plans;
        };
        calcularSemanaPlanejada.__plantaoReviewDedupFix = true;

        if(typeof fixarSemanaPlanejada === 'function' && !fixarSemanaPlanejada.__plantaoReviewDedupFix) {
            const originalFixar = fixarSemanaPlanejada;
            fixarSemanaPlanejada = function fixarSemanaSemRevisaoDuplicada(week, weekStart, today) {
                const result = originalFixar.call(this, dedupePlanMap(week || {}).plans, weekStart, today);
                const todayKey = today ? toKey(today) : toKey(new Date());
                if(dedupeFixedFrom(todayKey) && typeof save === 'function') save();
                return result;
            };
            fixarSemanaPlanejada.__plantaoReviewDedupFix = true;
        }

        if(typeof garantirDiaPlanejado === 'function' && !garantirDiaPlanejado.__plantaoReviewDedupFix) {
            const originalGarantir = garantirDiaPlanejado;
            garantirDiaPlanejado = function garantirDiaSemRevisaoDuplicada(dayKey) {
                const result = originalGarantir.apply(this, arguments);
                if(dedupeFixedFrom(dayKey) && typeof save === 'function') save();
                return result;
            };
            garantirDiaPlanejado.__plantaoReviewDedupFix = true;
        }

        if(typeof replanejarAgora === 'function' && !replanejarAgora.__plantaoReviewDedupFix) {
            const originalReplanejar = replanejarAgora;
            replanejarAgora = function replanejarSemRevisaoDuplicada() {
                const result = originalReplanejar.apply(this, arguments);
                const todayKey = toKey(new Date());
                if(dedupeFixedFrom(todayKey) && typeof save === 'function') save();
                return result;
            };
            replanejarAgora.__plantaoReviewDedupFix = true;
        }

        const todayKey = toKey(new Date());
        if(dedupeFixedFrom(todayKey) && typeof save === 'function') {
            save();
            if(typeof init === 'function') setTimeout(init, 0);
        }
        return true;
    }

    const timer = setInterval(() => {
        if(install()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 8000);
})();
