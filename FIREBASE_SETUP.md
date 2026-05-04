# Plantao Policia - Firebase e GitHub Pages

Este site esta preparado para rodar com:

- GitHub Pages para hospedagem.
- Firebase Authentication para login com Google.
- Cloud Firestore para salvar os dados por usuario.
- Backup criptografado como seguranca extra.

## 1. Criar projeto Firebase

1. Acesse https://console.firebase.google.com/
2. Crie um projeto.
3. Em Authentication, habilite o provedor Google.
4. Em Firestore Database, crie o banco em modo production.

## 2. Configurar app web

1. No Firebase, abra Project settings.
2. Em Your apps, adicione um app Web.
3. Copie o objeto `firebaseConfig`.
4. Edite `firebase-config.js` e substitua `null` pelo objeto copiado.

Exemplo:

```js
window.PLANTAO_FIREBASE_CONFIG = {
    apiKey: "SUA_API_KEY",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:000000000000"
};
```

## 3. Regras de seguranca do Firestore

Use estas regras para cada usuario acessar somente os proprios dados:

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /plantao-policial-users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 4. Dominios autorizados

Em Firebase Authentication > Settings > Authorized domains, inclua:

- `localhost`, se for testar localmente.
- Seu dominio do GitHub Pages, por exemplo:
  `luisadanierepro-netizen.github.io`

## 5. GitHub Pages

O GitHub Pages hospeda arquivos HTML, CSS e JavaScript diretamente de um repositorio. Depois que os arquivos forem para um repositorio, habilite Pages em:

`Settings > Pages > Deploy from a branch`

Escolha a branch principal e a pasta raiz.
