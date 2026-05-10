window.PLANTAO_SUPABASE_CONFIG = {
    url: "https://gwcafvegxkxyvgzdzsdu.supabase.co",
    anonKey: "sb_publishable_V2BXur3TO3bSOSWMK3a1xA_qLZ8xcu3"
};

(function fixPlantaoEncoding() {
    const STORAGE_KEY = 'prf_v120';
    const STORAGE_PATCHED = '__plantao_encoding_storage_patched__';
    const scoreMojibake = value => ((String(value).match(/[\u00c3\u0192\u00c3\u201a\ufffd]|\u00e2\u20ac|\u00c2|\u00c5|\u008d/g) || []).length);
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
            ['\ufffd', ''],
            ['\u00c3\u0192', '\u00c3'], ['\u00c3\u201a', ''],
            ['\u00c3\u2021', '\u00c7'], ['\u00c3\u2030', '\u00c9'], ['\u00c3\u0081', '\u00c1'],
            ['\u00c3\u008d', '\u00cd'], ['\u00c3\u201c', '\u00d3'], ['\u00c3\u0161', '\u00da'],
            ['\u00c3\u2022', '\u00d5'], ['\u00c3\u0160', '\u00ca'],
            ['\u00e2\u20ac\u0153', '"'], ['\u00e2\u20ac\u009d', '"'],
            ['\u00e2\u20ac\u02dc', "'"], ['\u00e2\u20ac\u2122', "'"],
            ['\u00e2\u20ac\u201c', '-'], ['\u00e2\u20ac\u201d', '-'], ['\u00e2\u20ac\u00a6', '...']
        ];

        for (let pass = 0; pass < 4; pass++) {
            replacements.forEach(([from, to]) => { text = replaceAll(text, from, to); });
            text = decodeLatin1Utf8(text);
        }

        const words = [
            ['PORTUGUES', 'PORTUGU\u00caS'], ['RACIOCINIO LOGICO', 'RACIOC\u00cdNIO L\u00d3GICO'],
            ['COMPREENSAO', 'COMPREENS\u00c3O'], ['INTERPRETACAO', 'INTERPRETA\u00c7\u00c3O'],
            ['PROPOSICOES', 'PROPOSI\u00c7\u00d5ES'], ['ADMINISTRACAO PUBLICA', 'ADMINISTRA\u00c7\u00c3O P\u00daBLICA'],
            ['MATERIA', 'MAT\u00c9RIA'], ['MATERIAS', 'MAT\u00c9RIAS'], ['REVISAO', 'REVIS\u00c3O'],
            ['QUESTOES', 'QUEST\u00d5ES'], ['LANCAMENTO', 'LAN\u00c7AMENTO'], ['LANCAMENTOS', 'LAN\u00c7AMENTOS'],
            ['HORARIO', 'HOR\u00c1RIO'], ['HORARIOS', 'HOR\u00c1RIOS'], ['DIARIA', 'DI\u00c1RIA'], ['DIARIAS', 'DI\u00c1RIAS'],
            ['MISSAO', 'MISS\u00c3O'], ['PRECISAO', 'PRECIS\u00c3O'], ['VOCE', 'VOC\u00ca'], ['AMANHA', 'AMANH\u00c3'],
            ['PROXIMO', 'PR\u00d3XIMO'], ['PROXIMOS', 'PR\u00d3XIMOS'], ['CODIGO', 'C\u00d3DIGO'], ['INICIO', 'IN\u00cdCIO'],
            ['ESTA', 'EST\u00c1'], ['PUBLICACAO', 'PUBLICA\u00c7\u00c3O'], ['APROVACAO', 'APROVA\u00c7\u00c3O'],
            ['SINCRONIZACAO', 'SINCRONIZA\u00c7\u00c3O'], ['DISTRIBUICAO', 'DISTRIBUI\u00c7\u00c3O'], ['SEQUENCIA', 'SEQU\u00caNCIA']
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
