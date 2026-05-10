window.PLANTAO_SUPABASE_CONFIG = {
    url: "https://gwcafvegxkxyvgzdzsdu.supabase.co",
    anonKey: "sb_publishable_V2BXur3TO3bSOSWMK3a1xA_qLZ8xcu3"
};

(function fixPlantaoEncoding() {
    const STORAGE_KEY = 'prf_v120';
    const STORAGE_PATCHED = '__plantao_encoding_storage_patched__';
    const ch = (...codes) => String.fromCharCode(...codes);
    const badCodes = new Set([0x00c3, 0x0192, 0x201a, 0xfffd, 0x00e2, 0x20ac, 0x00c2, 0x00c5, 0x008d]);
    const scoreMojibake = value => Array.from(String(value)).filter(char => badCodes.has(char.charCodeAt(0))).length;
    const titleCase = value => String(value).toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase());

    function replaceAll(text, from, to) {
        return text.split(from).join(to);
    }

    function decodeLatin1Utf8(text) {
        try {
            const decoded = decodeURIComponent(escape(text));
            return decoded && scoreMojibake(decoded) <= scoreMojibake(text) ? decoded : text;
        } catch (error) {
            return text;
        }
    }

    function fixText(value) {
        if (typeof value !== 'string') return value;
        let text = value;
        const replacements = [
            [ch(0xfffd), ''],
            [ch(0x00c3, 0x0192), ch(0x00c3)], [ch(0x00c3, 0x201a), ''],
            [ch(0x00c3, 0x2021), ch(0x00c7)], [ch(0x00c3, 0x2030), ch(0x00c9)],
            [ch(0x00c3, 0x0081), ch(0x00c1)], [ch(0x00c3, 0x008d), ch(0x00cd)],
            [ch(0x00c3, 0x201c), ch(0x00d3)], [ch(0x00c3, 0x0161), ch(0x00da)],
            [ch(0x00c3, 0x2022), ch(0x00d5)], [ch(0x00c3, 0x0160), ch(0x00ca)],
            [ch(0x00e2, 0x20ac, 0x0153), '"'], [ch(0x00e2, 0x20ac, 0x009d), '"'],
            [ch(0x00e2, 0x20ac, 0x02dc), "'"], [ch(0x00e2, 0x20ac, 0x2122), "'"],
            [ch(0x00e2, 0x20ac, 0x201c), '-'], [ch(0x00e2, 0x20ac, 0x201d), '-'],
            [ch(0x00e2, 0x20ac, 0x00a6), '...']
        ];

        for (let pass = 0; pass < 4; pass++) {
            replacements.forEach(([from, to]) => { text = replaceAll(text, from, to); });
            text = decodeLatin1Utf8(text);
        }

        const words = [
            ['PORTUGUES', 'PORTUGU' + ch(0x00ca) + 'S'], ['RACIOCINIO LOGICO', 'RACIOC' + ch(0x00cd) + 'NIO L' + ch(0x00d3) + 'GICO'],
            ['COMPREENSAO', 'COMPREENS' + ch(0x00c3) + 'O'], ['INTERPRETACAO', 'INTERPRETA' + ch(0x00c7) + ch(0x00c3) + 'O'],
            ['PROPOSICOES', 'PROPOSI' + ch(0x00c7) + ch(0x00d5) + 'ES'], ['ADMINISTRACAO PUBLICA', 'ADMINISTRA' + ch(0x00c7) + ch(0x00c3) + 'O P' + ch(0x00da) + 'BLICA'],
            ['MATERIA', 'MAT' + ch(0x00c9) + 'RIA'], ['MATERIAS', 'MAT' + ch(0x00c9) + 'RIAS'], ['REVISAO', 'REVIS' + ch(0x00c3) + 'O'],
            ['QUESTOES', 'QUEST' + ch(0x00d5) + 'ES'], ['LANCAMENTO', 'LAN' + ch(0x00c7) + 'AMENTO'], ['LANCAMENTOS', 'LAN' + ch(0x00c7) + 'AMENTOS'],
            ['HORARIO', 'HOR' + ch(0x00c1) + 'RIO'], ['HORARIOS', 'HOR' + ch(0x00c1) + 'RIOS'], ['DIARIA', 'DI' + ch(0x00c1) + 'RIA'], ['DIARIAS', 'DI' + ch(0x00c1) + 'RIAS'],
            ['MISSAO', 'MISS' + ch(0x00c3) + 'O'], ['PRECISAO', 'PRECIS' + ch(0x00c3) + 'O'], ['VOCE', 'VOC' + ch(0x00ca)], ['AMANHA', 'AMANH' + ch(0x00c3)],
            ['PROXIMO', 'PR' + ch(0x00d3) + 'XIMO'], ['PROXIMOS', 'PR' + ch(0x00d3) + 'XIMOS'], ['CODIGO', 'C' + ch(0x00d3) + 'DIGO'], ['INICIO', 'IN' + ch(0x00cd) + 'CIO'],
            ['ESTA', 'EST' + ch(0x00c1)], ['PUBLICACAO', 'PUBLICA' + ch(0x00c7) + ch(0x00c3) + 'O'], ['APROVACAO', 'APROVA' + ch(0x00c7) + ch(0x00c3) + 'O'],
            ['SINCRONIZACAO', 'SINCRONIZA' + ch(0x00c7) + ch(0x00c3) + 'O'], ['DISTRIBUICAO', 'DISTRIBUI' + ch(0x00c7) + ch(0x00c3) + 'O'], ['SEQUENCIA', 'SEQU' + ch(0x00ca) + 'NCIA']
        ];

        words.forEach(([from, to]) => {
            text = replaceAll(text, from, to);
            text = replaceAll(text, titleCase(from), titleCase(to));
            text = replaceAll(text, from.toLowerCase(), to.toLowerCase());
        });

        return text;
    }

    function normalize(value) {
        if (typeof value === 'string') return fixText(value);
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === 'object') {
            Object.keys(value).forEach(key => { value[key] = normalize(value[key]); });
        }
        return value;
    }

    function normalizeStoredJson(raw) {
        if (!raw) return raw;
        try {
            const parsed = normalize(JSON.parse(raw));
            return JSON.stringify(parsed);
        } catch (error) {
            return raw;
        }
    }

    if (!window[STORAGE_PATCHED] && window.Storage && Storage.prototype) {
        window[STORAGE_PATCHED] = true;
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
            const nextValue = key === STORAGE_KEY ? normalizeStoredJson(value) : value;
            return originalSetItem.call(this, key, nextValue);
        };
    }

    function fixDom(root = document.body) {
        if (!root) return;
        if (document.title) document.title = fixText(document.title);

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
                const current = el.getAttribute(attr);
                const fixed = fixText(current);
                if (fixed !== current) el.setAttribute(attr, fixed);
            });
            if (el.tagName === 'OPTION') {
                const fixed = fixText(el.textContent);
                if (fixed !== el.textContent) el.textContent = fixed;
            }
        });
    }

    window.plantaoFixText = fixText;
    window.plantaoNormalizeTextData = normalize;

    window.addEventListener('DOMContentLoaded', () => {
        fixDom();
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const fixed = fixText(node.nodeValue);
                        if (fixed !== node.nodeValue) node.nodeValue = fixed;
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        fixDom(node);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(fixDom, 0);
        setTimeout(fixDom, 250);
        setTimeout(fixDom, 1000);
    });
})();
