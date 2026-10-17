# Chácara Max

Site do restaurante e painel por senha, com catálogo e configurações persistidos no Cloudflare D1.

## Desenvolvimento

Requer Node.js 22 ou superior.

```sh
npm ci
cp .dev.vars.example .dev.vars
# Configure credenciais locais em .dev.vars.
npx wrangler d1 migrations apply chacara-max-catalogo --local
npm run dev
```

## Verificar e publicar

```sh
npm test
npm run check
npm run build
npm run deploy
```

O build gera `dist/` com `index.html`, estilos, scripts, imagens, `_routes.json` e o Worker compilado `_worker.js`. O deploy usa esse diretório completo. Para Direct Upload pelo painel Cloudflare, envie o conteúdo de `dist/`, com `_worker.js` na raiz; a pasta `functions/` contém código-fonte e precisa ser compilada.

No Cloudflare Pages, mantenha o banco D1 no binding `DB` e os segredos `ADMIN_PASSWORD` e `SESSION_SECRET`. Os valores dos segredos são configurados no Cloudflare, nunca no repositório. A configuração existente da conta e do banco está em `wrangler.toml`. Não é necessário recriar o banco para corrigir a senha.

O campo de senha usa estilos próprios, texto e cursor claros, tratamento de preenchimento automático e botão acessível Mostrar/Ocultar. O botão é carregado de forma independente do catálogo e da API. Os arquivos de interface possuem versão na URL para atualizar o navegador após a publicação.

## Publicação automática no mesmo Pages

O Pages existente foi criado por Direct Upload, e o Cloudflare não permite converter sua origem para a integração Git nativa. O workflow `Verificar e publicar no Cloudflare` publica pelo Wrangler no projeto `chacara-max`, mantendo o endereço `chacara-max.pages.dev`.

Para ativar, crie um token Cloudflare com a permissão **Account → Cloudflare Pages → Edit**, limitado à conta **Cogdev**. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e salve-o como **CLOUDFLARE_API_TOKEN**. Nunca inclua o valor no código ou em mensagens.

Depois execute o workflow em **Actions → Verificar e publicar no Cloudflare → Run workflow**. As próximas alterações na branch `main` serão verificadas, compiladas e publicadas automaticamente. Pull requests executam somente as verificações e o build.

Sem o segredo, o workflow informa **Publicação pendente** e disponibiliza o pacote completo `chacara-max-pages-upload` como artefato. O deploy não é executado. Os segredos do admin e o binding D1 continuam no Cloudflare.

O guia detalhado está em [LEIA-ME.md](LEIA-ME.md).
