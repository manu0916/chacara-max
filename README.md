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

No Cloudflare Pages, mantenha o banco D1 no binding `DB` e os segredos `ADMIN_PASSWORD` e `SESSION_SECRET`. Os valores dos segredos são configurados no Cloudflare, nunca no repositório. A configuração do banco existente está em `wrangler.toml`. Não é necessário recriar o banco para corrigir a senha.

O campo de senha usa estilos próprios, texto e cursor claros, tratamento de preenchimento automático e botão acessível Mostrar/Ocultar. O botão é carregado de forma independente do catálogo e da API. Os arquivos de interface possuem versão na URL para atualizar o navegador após a publicação.

## Publicação automática pelo Cloudflare Pages

O projeto `chacara-max` está conectado ao repositório `manu0916/chacara-max`, com a branch de produção `main`. O próprio Cloudflare compila e publica as alterações enviadas para essa branch.

Configuração de build do Pages:
- Comando: `npm run build`.
- Diretório de saída: `dist`.
- Diretório raiz: raiz do repositório.

O arquivo `wrangler.toml` define a saída e o banco D1; ele não contém `account_id`, pois a validação de configuração do Pages não aceita essa propriedade. O Cloudflare determina a conta pelo projeto conectado. Para deploy manual por CLI, use a conta autenticada no Wrangler ou a variável de ambiente `CLOUDFLARE_ACCOUNT_ID`.

O GitHub Actions executa somente testes, verificações e build, disponibilizando o pacote completo como artefato. A publicação automática é feita pela integração nativa do Cloudflare, sem exigir um token Cloudflare nos segredos do GitHub. Os segredos `ADMIN_PASSWORD`, `SESSION_SECRET` e o binding `DB` permanecem configurados no Pages.


O guia detalhado está em [LEIA-ME.md](LEIA-ME.md).
