window.PLANTAO_SUPABASE_CONFIG = {
    url: "https://gwcafvegxkxyvgzdzsdu.supabase.co",
    anonKey: "sb_publishable_V2BXur3TO3bSOSWMK3a1xA_qLZ8xcu3"
};

(function plantaoRuntimeFixes() {
    const APP_NAME = 'PLANTÃO';
    const STORAGE_KEY = 'prf_v120';
    const ch = (...codes) => String.fromCharCode(...codes);
    const badCodes = new Set([0x00c3, 0x0192, 0x201a, 0xfffd, 0x00e2, 0x20ac, 0x00c2, 0x00c5, 0x008d]);
    const score = value => Array.from(String(value)).filter(char => badCodes.has(char.charCodeAt(0))).length;
    const getDb = () => (typeof db !== 'undefined' ? db : window.db);
    const getViewDate = () => (typeof vDate !== 'undefined' ? vDate : new Date());
    const getMaxDailyItems = () => (typeof MAX_ESTUDO_DIA !== 'undefined' ? MAX_ESTUDO_DIA : 2);

    function replaceAll(text, from, to) { return text.split(from).join(to); }

    function decodeLatin1Utf8(text) {
        try {
            const decoded = decodeURIComponent(escape(text));
            return decoded && score(decoded) <= score(text) ? decoded : text;
        } catch (error) { return text; }
    }

    function fixText(value) {
        if (typeof value !== 'string') return value;
        let text = value;
        const replacements = [
            [ch(0xfffd), ''], [ch(0x00c3, 0x0192), ch(0x00c3)], [ch(0x00c3, 0x201a), ''],
            [ch(0x00c3, 0x2021), ch(0x00c7)], [ch(0x00c3, 0x2030), ch(0x00c9)], [ch(0x00c3, 0x0081), ch(0x00c1)],
            [ch(0x00c3, 0x008d), ch(0x00cd)], [ch(0x00c3, 0x201c), ch(0x00d3)], [ch(0x00c3, 0x0161), ch(0x00da)],
            [ch(0x00c3, 0x2022), ch(0x00d5)], [ch(0x00c3, 0x0160), ch(0x00ca)], [ch(0x00c3, 0x00a3), ch(0x00e3)],
            [ch(0x00c3, 0x00a9), ch(0x00e9)], [ch(0x00c3, 0x00a7), ch(0x00e7)], [ch(0x00c3, 0x00b5), ch(0x00f5)],
            [ch(0x00c3, 0x00ad), ch(0x00ed)], [ch(0x00c3, 0x00b3), ch(0x00f3)], [ch(0x00c3, 0x00ba), ch(0x00fa)],
            [ch(0x00e2, 0x20ac, 0x0153), '"'], [ch(0x00e2, 0x20ac, 0x009d), '"'], [ch(0x00e2, 0x20ac, 0x02dc), "'"],
            [ch(0x00e2, 0x20ac, 0x2122), "'"], [ch(0x00e2, 0x20ac, 0x201c), '-'], [ch(0x00e2, 0x20ac, 0x201d), '-']
        ];
        for (let pass = 0; pass < 4; pass++) {
            replacements.forEach(([from, to]) => { text = replaceAll(text, from, to); });
            text = decodeLatin1Utf8(text);
        }
        const words = [
            ['PLANTAO', 'PLANT' + ch(0x00c3) + 'O'], ['PORTUGUES', 'PORTUGU' + ch(0x00ca) + 'S'],
            ['RACIOCINIO LOGICO', 'RACIOC' + ch(0x00cd) + 'NIO L' + ch(0x00d3) + 'GICO'], ['COMPREENSAO', 'COMPREENS' + ch(0x00c3) + 'O'],
            ['INTERPRETACAO', 'INTERPRETA' + ch(0x00c7) + ch(0x00c3) + 'O'], ['PROPOSICOES', 'PROPOSI' + ch(0x00c7) + ch(0x00d5) + 'ES'],
            ['ADMINISTRACAO PUBLICA', 'ADMINISTRA' + ch(0x00c7) + ch(0x00c3) + 'O P' + ch(0x00da) + 'BLICA'], ['MATERIA', 'MAT' + ch(0x00c9) + 'RIA'],
            ['MATERIAS', 'MAT' + ch(0x00c9) + 'RIAS'], ['REVISAO', 'REVIS' + ch(0x00c3) + 'O'], ['QUESTOES', 'QUEST' + ch(0x00d5) + 'ES'],
            ['LANCAMENTOS', 'LAN' + ch(0x00c7) + 'AMENTOS'], ['HORARIOS', 'HOR' + ch(0x00c1) + 'RIOS'], ['DIARIAS', 'DI' + ch(0x00c1) + 'RIAS'],
            ['MISSAO', 'MISS' + ch(0x00c3) + 'O'], ['PRECISAO', 'PRECIS' + ch(0x00c3) + 'O'], ['VOCE', 'VOC' + ch(0x00ca)],
            ['AMANHA', 'AMANH' + ch(0x00c3)], ['PROXIMOS', 'PR' + ch(0x00d3) + 'XIMOS'], ['SEQUENCIA', 'SEQU' + ch(0x00ca) + 'NCIA']
        ];
        words.forEach(([from, to]) => {
            text = replaceAll(text, from, to);
            text = replaceAll(text, from.toLowerCase(), to.toLowerCase());
        });
        return text
            .replace(/PLANT(?:AO|.?O)/gi, APP_NAME)
            .replace(/\bPlant(?:[oóã]|ao)\b/gi, APP_NAME)
            .replace(/\s*v\.?\s*\d+\b/gi, '')
            .trim();
    }

    function normalize(value) {
        if (typeof value === 'string') return fixText(value);
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === 'object') Object.keys(value).forEach(key => { value[key] = normalize(value[key]); });
        return value;
    }

    function normalizeStoredJson(raw) {
        if (!raw) return raw;
        try { return JSON.stringify(normalize(JSON.parse(raw))); }
        catch (error) { return raw; }
    }

    if (!window.__plantao_storage_encoding_patched__ && window.Storage && Storage.prototype) {
        window.__plantao_storage_encoding_patched__ = true;
        const originalGetItem = Storage.prototype.getItem;
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.getItem = function getItemPatched(key) {
            const raw = originalGetItem.call(this, key);
            if (key !== STORAGE_KEY) return raw;
            const fixed = normalizeStoredJson(raw);
            if (fixed && fixed !== raw) originalSetItem.call(this, key, fixed);
            return fixed;
        };
        Storage.prototype.setItem = function setItemPatched(key, value) {
            return originalSetItem.call(this, key, key === STORAGE_KEY ? normalizeStoredJson(value) : value);
        };
    }

    function injectPolish() {
        if (!document.querySelector('link[href*="app-polish.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'app-polish.css?v=150';
            document.head.appendChild(link);
        }
    }

    function injectOverrides() {
        if (document.querySelector('script[src*="app-overrides.js"]')) return;
        const script = document.createElement('script');
        script.src = 'app-overrides.js?v=150';
        script.defer = true;
        document.body.appendChild(script);
    }

    function fixDom(root = document.body) {
        if (!root || !document.body) return;
        document.title = APP_NAME;
        document.body.classList.add('plantao-polished');
        root.querySelectorAll?.('.logo-box').forEach(el => {
            const icon = el.querySelector('i')?.outerHTML || '<i class="fas fa-shield-halved"></i>';
            el.innerHTML = `${icon} ${APP_NAME}`;
        });
        root.querySelectorAll?.('.login-card h2').forEach(el => { el.textContent = APP_NAME; });
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const fixed = fixText(node.nodeValue);
            if (fixed !== node.nodeValue) node.nodeValue = fixed;
        });
        root.querySelectorAll?.('[placeholder], [title], [aria-label], input[value], option').forEach(el => {
            ['placeholder', 'title', 'aria-label', 'value'].forEach(attr => {
                if (!el.hasAttribute?.(attr)) return;
                const fixed = fixText(el.getAttribute(attr));
                if (fixed !== el.getAttribute(attr)) el.setAttribute(attr, fixed);
            });
        });
        const replanButtons = Array.from(document.querySelectorAll('.replan-btn'));
        replanButtons.forEach((btn, index) => {
            btn.classList.add('btn-replan-primary');
            btn.title = 'Redistribuir atrasos nos próximos horários disponíveis';
            btn.style.display = index === 0 ? '' : 'none';
        });
    }

    function todayDate() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function toDateKey(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function addDays(date, amount) {
        const next = new Date(date);
        next.setDate(next.getDate() + amount);
        next.setHours(0, 0, 0, 0);
        return next;
    }

    const taskHours = task => Math.max(0.5, parseFloat(task?.h) || 1);
    const taskIsExtra = task => task?.extra === true || task?.l === 'Extra';
    const taskIsStudy = task => task?.k === 'E' || /estudo/i.test(String(task?.l || ''));
    const dayCapacity = date => Math.max(0, parseFloat(getDb()?.h?.[new Date(date).getDay()]) || 0);
    const usedHours = key => (getDb()?.metaFixa?.[key] || []).reduce((sum, task) => sum + taskHours(task), 0);
    const usedStudyCount = key => (getDb()?.metaFixa?.[key] || []).filter(task => !taskIsExtra(task) && taskIsStudy(task)).length;

    function dayCanReceive(key, date, task) {
        const capacity = dayCapacity(date);
        if (capacity <= 0) return false;
        if (usedHours(key) + taskHours(task) > capacity) return false;
        if (taskIsStudy(task) && usedStudyCount(key) >= getMaxDailyItems()) return false;
        return true;
    }

    function findSlot(task, startDate) {
        let fallback = null;
        for (let offset = 0; offset < 180; offset++) {
            const date = addDays(startDate, offset);
            const key = toDateKey(date);
            if (!fallback && dayCapacity(date) > 0 && (!taskIsStudy(task) || usedStudyCount(key) < getMaxDailyItems())) fallback = key;
            if (dayCanReceive(key, date, task)) return key;
        }
        return fallback || toDateKey(startDate);
    }

    function collectOverdueTasks() {
        const state = getDb();
        const todayKey = toDateKey(todayDate());
        const overdue = [];
        Object.keys(state?.metaFixa || {}).sort().forEach(key => {
            if (key >= todayKey) return;
            const remaining = [];
            (state.metaFixa[key] || []).forEach(task => {
                if (!task?.c && !taskIsExtra(task)) overdue.push({ ...task, c: false, atraso: false, replanejado: true, origemAtraso: task.origemAtraso || key });
                else remaining.push(task);
            });
            if (remaining.length) state.metaFixa[key] = remaining;
            else delete state.metaFixa[key];
        });
        return overdue;
    }

    function refreshAfterReplan() {
        if (typeof save === 'function') save();
        if (typeof renderDiario === 'function') renderDiario(getViewDate());
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderReplanejar === 'function') renderReplanejar();
        setTimeout(() => fixDom(), 50);
    }

    function replanejarAgoraCorrigido() {
        const state = getDb();
        if (!state?.metaFixa) return;
        const overdue = collectOverdueTasks();
        if (!overdue.length) {
            if (typeof showToast === 'function') showToast('Sem atrasos', 'Não encontrei matérias atrasadas para redistribuir.');
            refreshAfterReplan();
            return;
        }
        const start = todayDate();
        overdue.forEach(task => {
            const key = findSlot(task, start);
            if (!state.metaFixa[key]) state.metaFixa[key] = [];
            state.metaFixa[key].push(task);
        });
        refreshAfterReplan();
        if (typeof showToast === 'function') showToast('Atrasos replanejados', `${overdue.length} atividade(s) redistribuída(s) respeitando horas diárias e limite de estudos.`);
    }

    function resetStudyPromptForCard(card) {
        const state = getDb();
        const text = fixText(card?.innerText || '').toLowerCase();
        if (!state?.metaFixa || !text) return;
        Object.values(state.metaFixa).flat().forEach(task => {
            const subject = fixText(`${task?.m || ''} ${task?.a || ''}`).toLowerCase();
            if (!subject || !text.includes(subject.split(' ').slice(0, 3).join(' '))) return;
            task.c = false;
            if (task.done) task.done.E = false;
            task.hF = 0;
            task.teoriaRespondida = false;
            task.teoriaPendente = false;
            task.precisaMaisTempo = false;
            delete task.lastInitialStudyDate;
        });
        if (typeof save === 'function') save();
    }

    function installCheckboxReset() {
        if (window.__plantao_checkbox_reset_installed__) return;
        window.__plantao_checkbox_reset_installed__ = true;
        document.addEventListener('change', event => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox' || input.checked) return;
            const card = input.closest('.task-card');
            if (!card) return;
            setTimeout(() => resetStudyPromptForCard(card), 30);
        }, true);
    }

    function installOverrides() {
        window.replanejarAgora = replanejarAgoraCorrigido;
        installCheckboxReset();
    }

    window.plantaoFixText = fixText;
    window.plantaoNormalizeTextData = normalize;

    function boot() {
        injectPolish();
        installOverrides();
        fixDom();
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'characterData') {
                    const fixed = fixText(mutation.target.nodeValue);
                    if (fixed !== mutation.target.nodeValue) mutation.target.nodeValue = fixed;
                }
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const fixed = fixText(node.nodeValue);
                        if (fixed !== node.nodeValue) node.nodeValue = fixed;
                    } else if (node.nodeType === Node.ELEMENT_NODE) fixDom(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        setTimeout(() => { installOverrides(); fixDom(); }, 250);
        setTimeout(() => { installOverrides(); fixDom(); injectOverrides(); }, 1000);
        setTimeout(() => { fixDom(); injectOverrides(); }, 2200);
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
