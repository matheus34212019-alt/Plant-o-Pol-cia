const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const moduleCode = fs.readFileSync(path.join(__dirname, '..', 'sync-integrity-fix.js'), 'utf8');

class MemoryStorage {
    constructor() {
        this.data = new Map();
    }
    getItem(key) {
        return this.data.has(key) ? this.data.get(key) : null;
    }
    setItem(key, value) {
        this.data.set(key, String(value));
    }
    keys() {
        return [...this.data.keys()];
    }
}

function createRuntime() {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    const events = [];
    const toasts = [];
    const backups = [];
    let remote = { data: { lista: [{ m: 'Direito' }] }, updated_at: 'r1' };
    let rpcCalls = 0;
    let unsafeCalls = 0;

    const context = {
        console,
        Date,
        JSON,
        Math,
        Promise,
        localStorage,
        sessionStorage,
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout: () => 1,
        document: { body: { dataset: {} } },
        __plantaoDataSafetyWrapped: true,
        __plantaoGetActiveDataKey: () => 'student-key',
        __plantaoRecoverSilently: () => false,
        __plantaoLogRuntimeEvent: (type, detail) => events.push({ type, detail }),
        db: { lista: [{ m: 'Direito' }] },
        dadosSupabaseCarregados: true,
        cloudUser: { id: '00000000-0000-0000-0000-000000000001' },
        alvoDadosNuvem: () => ({ user_id: '00000000-0000-0000-0000-000000000001' }),
        carregarDadosSupabase: async () => true,
        salvarDadosSupabase: async () => { unsafeCalls += 1; },
        setSalvamentoStatus: () => {},
        showToast: (title, body) => toasts.push({ title, body }),
        supabaseClient: {
            from(table) {
                return {
                    select() { return this; },
                    eq() { return this; },
                    maybeSingle: async () => ({ data: JSON.parse(JSON.stringify(remote)), error: null }),
                    insert: async payload => {
                        assert.equal(table, 'plantao_user_backups');
                        backups.push(payload);
                        return { error: null };
                    },
                    upsert: async payload => {
                        remote = { data: payload.data, updated_at: payload.updated_at };
                        return { error: null };
                    }
                };
            },
            rpc: async (_name, payload) => {
                rpcCalls += 1;
                remote = { data: payload.p_data, updated_at: 'r2' };
                return { data: [{ ok: true, conflict: false, updated_at: 'r2' }], error: null };
            }
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(moduleCode, context, { filename: 'sync-integrity-fix.js' });
    return {
        context,
        events,
        toasts,
        backups,
        setRemote(next) { remote = next; },
        rpcCalls: () => rpcCalls,
        unsafeCalls: () => unsafeCalls,
        localStorage
    };
}

test('salvamento usa gravacao revisionada sem chamar fluxo vulneravel anterior', async () => {
    const runtime = createRuntime();
    await runtime.context.carregarDadosSupabase();
    runtime.context.db.lista.push({ m: 'Constitucional' });
    await runtime.context.salvarDadosSupabase();
    assert.equal(runtime.rpcCalls(), 1);
    assert.equal(runtime.unsafeCalls(), 0);
    assert.equal(runtime.toasts.length, 0);
});

test('edicao concorrente preserva a copia local e nao sobrescreve a nuvem', async () => {
    const runtime = createRuntime();
    await runtime.context.carregarDadosSupabase();
    runtime.context.db.lista.push({ m: 'Processo Penal' });
    runtime.setRemote({ data: { lista: [{ m: 'Versao de outro dispositivo' }] }, updated_at: 'r2-other' });
    await runtime.context.salvarDadosSupabase();
    assert.equal(runtime.rpcCalls(), 0);
    assert.equal(runtime.unsafeCalls(), 0);
    assert.equal(runtime.backups.length, 1);
    assert.ok(runtime.localStorage.keys().some(key => key.startsWith('plantao_conflict_copy_v1_')));
    assert.match(runtime.toasts[0].title, /Mudan/);
});