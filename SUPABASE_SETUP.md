# Plantao Policia - Supabase

Use este caminho se quiser login com Google e dados salvos na nuvem sem depender do Firestore.

## 1. Criar projeto

1. Acesse https://supabase.com/dashboard
2. Crie uma conta ou entre com GitHub/Google.
3. Clique em `New project`.
4. Escolha uma organizacao, nome do projeto e senha do banco.
5. Aguarde o projeto ficar pronto.

## 2. Criar tabela dos dados

No Supabase, abra `SQL Editor` e rode:

```sql
create table if not exists public.plantao_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  email text,
  updated_at timestamptz default now()
);

alter table public.plantao_user_data enable row level security;

drop policy if exists "Usuarios leem os proprios dados" on public.plantao_user_data;
create policy "Usuarios leem os proprios dados"
on public.plantao_user_data
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Usuarios gravam os proprios dados" on public.plantao_user_data;
create policy "Usuarios gravam os proprios dados"
on public.plantao_user_data
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Usuarios atualizam os proprios dados" on public.plantao_user_data;
create policy "Usuarios atualizam os proprios dados"
on public.plantao_user_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 3. Ativar Google Login

No painel do Supabase:

1. Abra `Authentication`.
2. Abra `Providers`.
3. Ative `Google`.
4. Configure Client ID e Client Secret do Google.

Para testes simples, voce tambem pode ativar login por email/magic link, mas o site ja esta preparado para Google.

## 4. Pegar URL e anon key

No Supabase:

1. Abra `Project Settings`.
2. Clique em `API`.
3. Copie:
   - `Project URL`
   - `anon public key`

Depois edite `supabase-config.js`:

```js
window.PLANTAO_SUPABASE_CONFIG = {
    url: "https://seu-projeto.supabase.co",
    anonKey: "SUA_ANON_KEY"
};
```

## 5. Configurar URL do site

Em `Authentication > URL Configuration`:

- Site URL:
  `https://luisadanierepro-netizen.github.io/Plant-o-Pol-cia/`

- Redirect URLs:
  `https://luisadanierepro-netizen.github.io/Plant-o-Pol-cia/`

Depois envie o `supabase-config.js` atualizado para o GitHub.
