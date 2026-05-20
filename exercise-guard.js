(function exerciseGuard() {
    if (window.__plantaoExerciseGuardLoaded) return;
    window.__plantaoExerciseGuardLoaded = true;

    const BAD = '(?:\\?|\\ufffd|\\u00ef\\u00bf\\u00bd)';
    const TEXT_FIXES = [
        [new RegExp(`FOR${BAD}A`, 'g'), 'FOR\u00c7A'],
        [new RegExp(`For${BAD}a`, 'g'), 'For\u00e7a'],
        [new RegExp(`for${BAD}a`, 'g'), 'for\u00e7a'],
        [new RegExp(`Parab${BAD}ns`, 'g'), 'Parab\u00e9ns'],
        [new RegExp(`parab${BAD}ns`, 'g'), 'parab\u00e9ns'],
        [new RegExp(`Voc${BAD}`, 'g'), 'Voc\u00ea'],
        [new RegExp(`voc${BAD}`, 'g'), 'voc\u00ea'],
        [new RegExp(`AMANH(?:${BAD}|\\u00c3)`, 'g'), 'AMANH\u00c3'],
        [new RegExp(`Amanh(?:${BAD}|\\u00c3)`, 'g'), 'Amanh\u00e3'],
        [new RegExp(`amanh(?:${BAD}|\\u00c3)`, 'g'), 'amanh\u00e3'],
        [new RegExp(`Miss${BAD}o`, 'g'), 'Miss\u00e3o'],
        [new RegExp(`miss${BAD}o`, 'g'), 'miss\u00e3o'],
        [new RegExp(`Revis${BAD}o`, 'g'), 'Revis\u00e3o'],
        [new RegExp(`revis${BAD}o`, 'g'), 'revis\u00e3o'],
        [new RegExp(`Exerc${BAD}cios`, 'g'), 'Exerc\u00edcios'],
        [new RegExp(`exerc${BAD}cios`, 'g'), 'exerc\u00edcios'],
        [new RegExp(`Mat${BAD}ria`, 'g'), 'Mat\u00e9ria'],
        [new RegExp(`mat${BAD}ria`, 'g'), 'mat\u00e9ria'],
        [new RegExp(`pr${BAD}ximo`, 'g'), 'pr\u00f3ximo'],
        [new RegExp(`Pr${BAD}ximo`, 'g'), 'Pr\u00f3ximo'],
        [new RegExp(`pr${BAD}ximos`, 'g'), 'pr\u00f3ximos'],
        [new RegExp(`Pr${BAD}ximos`, 'g'), 'Pr\u00f3ximos'],
        [new RegExp(`n${BAD}o`, 'g'), 'n\u00e3o'],
        [new RegExp(`N${BAD}o`, 'g'), 'N\u00e3o'],
        [/PLANT(?:AO|\u00c3\u0192O|\u00c3\ufffdO|\ufffdO|\?O)/g, 'PLANT\u00c3O'],
        [/Plant(?:ao|\u00c3\u00a3o|\ufffdo|\?o)/g, 'Plant\u00e3o'],
        [/plant(?:ao|\u00c3\u00a3o|\ufffdo|\?o)/g, 'plant\u00e3o']
    ];

    function isExtraTask(task) {
        return task && (task.extra === true || task.l === 'Extra' || task.k === 'Extra');
    }

    function toDate(key) {
        if (typeof keyToDate === 'function') return keyToDate(key);
        const parts = String(key || '').split('-').map(Number);
        return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    }

    function toKey(date) {
        if (typeof dateKey === 'function') return dateKey(date);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function plusDays(date, days) {
        if (typeof addDays === 'function') return addDays(date, days);
        const copy = new Date(date);
        copy.setDate(copy.getDate() + days);
        return copy;
    }

    function normalizeText(value) {
        const input = String(value || '').normalize('NFD').toLowerCase();
        let output = '';
        let spaced = false;
        for (const char of input) {
            const code = char.charCodeAt(0);
            if (code >= 0x0300 && code <= 0x036f) continue;
            const alpha = code >= 97 && code <= 122;
            const number = code >= 48 && code <= 57;
            if (alpha || number) {
                output += char;
                spaced = false;
            } else if (output && !spaced) {
                output += ' ';
                spaced = true;
            }
        }
        return output.trim();
    }

    function taskKeys(task) {
        const keys = [];
        if (!task) return keys;
        if (task.itemId) keys.push(`id:${task.itemId}`);
        const textKey = `${normalizeText(task.m)}|${normalizeText(task.a)}`;
        if (textKey !== '|') keys.push(`txt:${textKey}`);
        return keys;
    }

    function isExercise(task) {
        return task && task.k === 'Ex' && !isExtraTask(task);
    }

    function isReview(task) {
        return task && task.k === 'Rev' && !isExtraTask(task);
    }

    function isLocked(task) {
        return isExtraTask(task) || task?.c;
    }

    function sameSubject(a, b) {
        const aKeys = taskKeys(a);
        const bKeys = new Set(taskKeys(b));
        return aKeys.some((key) => bKeys.has(key));
    }

    function hasMatchingReview(task, reviewKeys) {
        return taskKeys(task).some((key) => reviewKeys.has(key));
    }

    function addReviewKeys(task, reviewKeys) {
        taskKeys(task).forEach((key) => reviewKeys.add(key));
    }

    function itemFor(task) {
        return db && db.lista ? db.lista.find((entry) => entry.id === (task && task.itemId)) : null;
    }

    function itemAllowsInitialExercise(task, dayKey) {
        const item = itemFor(task);
        if (!item || item.f || !item.lastInitialRevDate) return false;
        return toDate(item.lastInitialRevDate) < toDate(dayKey);
    }

    function makeReviewBeforeExercise(exercise, dayKey) {
        const item = itemFor(exercise);
        let review = null;
        if (item && typeof criarTask === 'function') {
            review = criarTask(item, 'Rev', parseFloat(item.h?.Rev) || 1, dayKey);
        } else {
            const cycle = String(exercise?.l || '').match(/Ciclo\s+\d+/i)?.[0];
            review = {
                ...exercise,
                k: 'Rev',
                l: cycle ? `Revisao - ${cycle}` : 'Revisao',
                h: parseFloat(exercise?.h) || 1,
                c: false,
                data: dayKey
            };
        }
        review.h = parseFloat(review.h) || 1;
        review.c = false;
        review.data = dayKey;
        review.revisaoInseridaAntesDoExercicio = true;
        delete review.perf;
        return review;
    }

    function collectPriorReviews(dayKey, extraPlans) {
        const reviewKeys = new Set();
        const target = toDate(dayKey);
        const sources = [db && db.metaFixa ? db.metaFixa : {}, extraPlans || {}];
        sources.forEach((plans) => {
            Object.entries(plans).forEach(([key, tasks]) => {
                if (toDate(key) >= target) return;
                (tasks || []).forEach((task) => {
                    if (isReview(task)) addReviewKeys(task, reviewKeys);
                });
            });
        });
        return reviewKeys;
    }

    function ensureReviewsBeforeExercises(tasks, dayKey, priorReviewKeys) {
        const output = [];
        (tasks || []).forEach((task) => {
            if (isExercise(task) && !hasMatchingReview(task, priorReviewKeys) && !itemAllowsInitialExercise(task, dayKey)) {
                const reviewAlreadyBefore = output.some((candidate) => isReview(candidate) && sameSubject(candidate, task));
                if (!reviewAlreadyBefore) {
                    const review = makeReviewBeforeExercise(task, dayKey);
                    output.push(review);
                    addReviewKeys(review, priorReviewKeys);
                }
            }
            output.push(task);
            if (isReview(task)) addReviewKeys(task, priorReviewKeys);
        });
        return output;
    }

    function dayLimit(dayKey) {
        const date = toDate(dayKey);
        return parseFloat(db?.h?.[date.getDay()]) || 0;
    }

    function totalPlanned(tasks) {
        return (tasks || [])
            .filter((task) => !isExtraTask(task))
            .reduce((total, task) => total + (parseFloat(task.h) || 0), 0);
    }

    function nextOpenDay(dayKey) {
        let date = toDate(dayKey);
        for (let step = 1; step <= 365; step += 1) {
            date = plusDays(date, 1);
            const key = toKey(date);
            if (typeof diaPausado === 'function' && diaPausado(key)) continue;
            if (dayLimit(key) <= 0) continue;
            return key;
        }
        return toKey(plusDays(toDate(dayKey), 1));
    }

    function moveOverflow(tasks, dayKey) {
        const limit = dayLimit(dayKey);
        const kept = [...(tasks || [])];
        const overflow = [];
        if (limit <= 0) {
            return {
                kept: kept.filter(isLocked),
                overflow: kept.filter((task) => !isLocked(task))
            };
        }
        while (totalPlanned(kept) > limit + 0.01) {
            const index = kept.map((task, idx) => ({ task, idx })).reverse().find((entry) => !isLocked(entry.task))?.idx;
            if (index === undefined) break;
            overflow.unshift(kept.splice(index, 1)[0]);
        }
        return { kept, overflow };
    }

    function ensurePlanMap(plans) {
        const source = {};
        Object.entries(plans || {}).forEach(([key, tasks]) => {
            source[key] = (tasks || []).map((task) => ({ ...task }));
        });

        const output = {};
        const carry = {};
        const allKeys = new Set(Object.keys(source));
        let cursor = Object.keys(source).sort((a, b) => toDate(a) - toDate(b))[0] || toKey(new Date());

        for (let safety = 0; safety < 380; safety += 1) {
            const key = [...allKeys, ...Object.keys(carry)]
                .filter((candidate) => toDate(candidate) >= toDate(cursor))
                .sort((a, b) => toDate(a) - toDate(b))[0];
            if (!key) break;
            cursor = key;

            const tasks = [...(carry[key] || []), ...(source[key] || [])];
            delete carry[key];
            allKeys.delete(key);

            if (typeof diaPausado === 'function' && diaPausado(key)) {
                const next = nextOpenDay(key);
                carry[next] = [...(carry[next] || []), ...tasks.map((task) => ({ ...task, data: next }))];
                cursor = toKey(plusDays(toDate(key), 1));
                continue;
            }

            const prior = collectPriorReviews(key, output);
            const ordered = ensureReviewsBeforeExercises(tasks, key, prior);
            const split = moveOverflow(ordered, key);
            output[key] = split.kept.map((task) => ({ ...task, data: key }));
            if (split.overflow.length) {
                const next = nextOpenDay(key);
                carry[next] = [...(carry[next] || []), ...split.overflow.map((task) => ({ ...task, data: next }))];
            }
            cursor = toKey(plusDays(toDate(key), 1));
        }

        return output;
    }

    function ensureFixedFrom(startKey) {
        if (!db || !db.metaFixa) return false;
        const future = {};
        Object.keys(db.metaFixa).forEach((key) => {
            if (toDate(key) >= toDate(startKey)) future[key] = db.metaFixa[key];
        });
        const ensured = ensurePlanMap(future);
        let changed = false;
        const keys = new Set([...Object.keys(future), ...Object.keys(ensured)]);
        keys.forEach((key) => {
            const next = ensured[key] || [];
            if (JSON.stringify(db.metaFixa[key] || []) !== JSON.stringify(next)) {
                if (next.length) db.metaFixa[key] = next;
                else delete db.metaFixa[key];
                if (typeof atualizarPlanoDiaTravado === 'function') atualizarPlanoDiaTravado(key);
                changed = true;
            }
        });
        return changed;
    }

    function fixTextValue(value) {
        if (typeof value !== 'string') return value;
        return TEXT_FIXES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
    }

    function fixVisibleText(root = document.body) {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
            const fixed = fixTextValue(node.nodeValue);
            if (fixed !== node.nodeValue) node.nodeValue = fixed;
        });
        root.querySelectorAll?.('[placeholder], [title], [aria-label], [data-label]').forEach((el) => {
            ['placeholder', 'title', 'aria-label', 'data-label'].forEach((attr) => {
                const original = el.getAttribute(attr);
                const fixed = fixTextValue(original);
                if (fixed !== original) el.setAttribute(attr, fixed);
            });
        });
        document.title = fixTextValue(document.title);
    }

    function wrapRender(name) {
        if (typeof window[name] !== 'function' || window[name].__plantaoExerciseGuardTextFix) return;
        const original = window[name];
        window[name] = function wrappedRender(...args) {
            const result = original.apply(this, args);
            setTimeout(fixVisibleText, 0);
            return result;
        };
        window[name].__plantaoExerciseGuardTextFix = true;
    }

    function install() {
        if (typeof calcularSemanaPlanejada === 'function' && !calcularSemanaPlanejada.__plantaoExerciseGuard) {
            const original = calcularSemanaPlanejada;
            calcularSemanaPlanejada = function calcularSemanaComRevisaoAntesDoExercicio() {
                return ensurePlanMap(original.apply(this, arguments));
            };
            calcularSemanaPlanejada.__plantaoExerciseGuard = true;
        }

        if (typeof fixarSemanaPlanejada === 'function' && !fixarSemanaPlanejada.__plantaoExerciseGuard) {
            const original = fixarSemanaPlanejada;
            fixarSemanaPlanejada = function fixarSemanaComRevisaoAntesDoExercicio(week, weekStart, today) {
                const ensured = ensurePlanMap(week || {});
                const result = original.call(this, ensured, weekStart, today);
                const todayKey = today ? toKey(today) : toKey(new Date());
                if (ensureFixedFrom(todayKey) && typeof save === 'function') save();
                return result;
            };
            fixarSemanaPlanejada.__plantaoExerciseGuard = true;
        }

        if (typeof garantirDiaPlanejado === 'function' && !garantirDiaPlanejado.__plantaoExerciseGuard) {
            const original = garantirDiaPlanejado;
            garantirDiaPlanejado = function garantirDiaComRevisaoAntesDoExercicio(dayKey, date) {
                const result = original.apply(this, arguments);
                if (ensureFixedFrom(dayKey) && typeof save === 'function') save();
                return result;
            };
            garantirDiaPlanejado.__plantaoExerciseGuard = true;
        }

        if (typeof replanejarAgora === 'function' && !replanejarAgora.__plantaoExerciseGuard) {
            const original = replanejarAgora;
            replanejarAgora = function replanejarComRevisaoAntesDoExercicio() {
                const result = original.apply(this, arguments);
                const todayKey = toKey(new Date());
                if (ensureFixedFrom(todayKey) && typeof save === 'function') save();
                return result;
            };
            replanejarAgora.__plantaoExerciseGuard = true;
        }

        ['renderDiario', 'renderSemanal', 'updateDashboard', 'renderReplanejamento', 'renderPerfil'].forEach(wrapRender);
        fixVisibleText();
        setTimeout(fixVisibleText, 100);
        setTimeout(fixVisibleText, 600);
        setTimeout(fixVisibleText, 1600);

        let pending = false;
        new MutationObserver(() => {
            if (pending) return;
            pending = true;
            setTimeout(() => {
                pending = false;
                fixVisibleText();
            }, 50);
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', install);
    else install();
})();
