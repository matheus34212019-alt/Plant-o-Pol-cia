# Plantao Policia

Sistema pessoal de planejamento de estudos com:

- cronograma semanal;
- ciclo inicial de estudo, revisao e exercicios;
- ciclos de revisao programada;
- performance por questoes e horas;
- backup criptografado;
- login Google e sincronizacao em nuvem via Supabase ou Firebase, quando configurado.

## Como publicar no GitHub Pages

1. Crie um repositorio no GitHub.
2. Envie estes arquivos para a raiz do repositorio.
3. Em `Settings > Pages`, escolha `Deploy from a branch`.
4. Selecione a branch principal e a pasta `/root`.
5. Aguarde o link do GitHub Pages ser gerado.

## Supabase

O caminho recomendado agora e Supabase. O site funciona localmente enquanto `supabase-config.js` estiver com `null`.

Para ativar login Google e dados na nuvem, siga o passo a passo em `SUPABASE_SETUP.md`.

## Firebase

O site funciona localmente enquanto `firebase-config.js` estiver com `null`.

O Firebase continua suportado como alternativa em `FIREBASE_SETUP.md`.

