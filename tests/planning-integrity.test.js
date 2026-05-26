const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const replanCode = fs.readFileSync(path.join(__dirname, '..', 'overdue-replan-fix.js'), 'utf8');
const historyCode = fs.readFileSync(path.join(__dirname, '..', 'history-preservation-fix.js'), 'utf8');

function documentStub() {
    return {
        readyState: 'complete',
        documentElement: { dataset: {} },
        addEventListener: () => {}
    };
}

function runReplanner(db) {
    let saved = 0;
    const context = {
        window: null,
        db,
        document: documentStub(),
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout: () => 1,
        replanejarAgora: () => {},
        save: () => { saved += 1; },
        init: () => {},
        updateDashboard: () => {},
        showToast: () => {},
        confirmarAcaoPlano: () => true
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(replanCode, context, { filename: 'overdue-replan-fix.js' });
    context.replanejarAgora();
    return { db: context.db, saved };
}

test('replanejamento mantem atraso quando nao existe capacidade futura', () => {
    const result = runReplanner({
        h: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        metaFixa: {
            '01/01/2020': [{ m: 'Penal', a: 'Crime', h: 1, k: 'E', l: 'Estudo', c: false }]
        }
    });
    assert.equal(result.db.metaFixa['01/01/2020'].length, 1);
    assert.equal(result.saved, 0);
});

test('replanejamento remove o atraso apenas depois de recoloca-lo', () => {
    const result = runReplanner({
        h: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 },
        metaFixa: {
            '01/01/2020': [{ m: 'Penal', a: 'Crime', h: 1, k: 'E', l: 'Estudo', c: false }]
        }
    });
    assert.equal(result.db.metaFixa['01/01/2020'], undefined);
    const moved = Object.values(result.db.metaFixa).flat().filter(task => task.replanejadoDe === '01/01/2020');
    assert.equal(moved.length, 1);
    assert.equal(result.saved, 1);
});

test('alterar horas nao remove atividade concluida do historico', () => {
    let saves = 0;
    const completed = { m: 'Penal', a: 'Crime', h: 1, k: 'E', l: 'Estudo', c: true };
    const context = {
        window: null,
        db: { metaFixa: { '10/05/2026': [completed] } },
        document: documentStub(),
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout: () => 1,
        save: () => { saves += 1; },
        normalizarBanco: () => {},
        saveH: () => { context.db.metaFixa = {}; },
        desmarcarLancamento: () => {}
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(historyCode, context, { filename: 'history-preservation-fix.js' });
    context.saveH();
    assert.equal(context.db.historicoEstudos.length, 1);
    assert.equal(context.db.metaFixa['10/05/2026'][0].c, true);
    assert.equal(saves, 1);
});