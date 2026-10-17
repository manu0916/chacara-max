# Publicação do Chácara Max

O projeto contém o site, painel administrativo por senha, API do catálogo, fotos e dados da casa, além das migrações do D1. As alterações do painel são verificadas pelo servidor e persistidas no banco.

## Estrutura

- `public/`: interface do site e do painel.
- `functions/` e `lib/`: API autenticada do Pages.
- `migrations/`: estrutura do banco.
- `dist/`: resultado gerado de publicação, incluindo `_worker.js` compilado e `_routes.json`.

## Preparar o ambiente

Use Node.js 22 ou superior e execute `npm ci`.

Para testar localmente, copie `.dev.vars.example` para `.dev.vars` e preencha valores próprios. A senha administrativa e a chave de sessão não devem ser incluídas no Git. Configure uma chave de sessão aleatória com pelo menos 32 caracteres.

```sh
npx wrangler d1 migrations apply chacara-max-catalogo --local
npm run dev
```

## Publicar no Cloudflare existente

O projeto Pages é `chacara-max`. O binding D1 chama-se `DB`; a conta e o banco existentes estão definidos em `wrangler.toml`. Mantenha esse banco para preservar os produtos, contatos e configurações já cadastrados.

Os segredos de produção necessários são `ADMIN_PASSWORD` e `SESSION_SECRET`. Se já estiverem cadastrados no Pages, preserve os valores. Caso esteja preparando uma nova instalação, cadastre-os pelo painel ou pelos prompts seguros:

```sh
npx wrangler pages secret put ADMIN_PASSWORD --project-name chacara-max
npx wrangler pages secret put SESSION_SECRET --project-name chacara-max
```

Uma nova instalação também precisa das migrações do banco. A correção de visualização de senha não exige recriar, limpar ou migrar o banco existente.

```sh
npm test
npm run check
npm run deploy
```

O comando de deploy gera `dist/` antes de publicar. Para upload manual pelo painel, execute `npm run build` e envie o conteúdo inteiro de `dist/`. Verifique que `index.html`, `password-field.css`, `password-field.js`, `_worker.js` e `_routes.json` estão na raiz do upload. Não envie o código-fonte de `functions/` como se já estivesse compilado.

## Publicação automática no mesmo Pages

O Pages existente foi criado por Direct Upload, e o Cloudflare não permite converter sua origem para a integração Git nativa. O workflow `Verificar e publicar no Cloudflare` publica pelo Wrangler no projeto `chacara-max`, mantendo o endereço `chacara-max.pages.dev`.

Para ativar, crie um token Cloudflare com a permissão **Account → Cloudflare Pages → Edit**, limitado à conta **Cogdev**. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e salve-o como **CLOUDFLARE_API_TOKEN**. Nunca inclua o valor no código ou em mensagens.

Depois execute o workflow em **Actions → Verificar e publicar no Cloudflare → Run workflow**. As próximas alterações na branch `main` serão verificadas, compiladas e publicadas automaticamente. Pull requests executam somente as verificações e o build.

Sem o segredo, o workflow informa **Publicação pendente** e disponibiliza o pacote completo `chacara-max-pages-upload` como artefato. O deploy não é executado. Os segredos do admin e o binding D1 continuam no Cloudflare.


## Senha e demonstração

A senha de produção é verificada pela API usando o segredo `ADMIN_PASSWORD`. O botão Mostrar/Ocultar altera somente a visualização no navegador e preserva o texto digitado. O campo tem cores explícitas para texto, cursor e preenchimento automático, e usa fonte de 16px em celulares.

A prévia independente pode ser gerada com `python3 scripts/make-preview.py`. Sua senha de demonstração é `demo-local-only`; os dados dessa demonstração ficam somente no navegador e não alteram o D1. A prévia não é o arquivo de publicação do Pages.

## Verificar depois da publicação

Abra `/admin`, digite texto fictício sem enviar o formulário e confira as duas posições do botão Mostrar/Ocultar. Depois faça o login normalmente. Teste uma alteração dos contatos e confira a atualização da página pública. Os testes automatizados cobrem login, sessão, produtos, fotos, persistência dos contatos e conflitos de edição.
