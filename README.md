# CRM WHITE LABEL

Stack:
- **Next.js 15** (App Router)
- **TailwindCSS** (estilização; classes shadcn-like incluídas em `globals.css`)
- **React Hook Form + Zod** (validação)
- **PostgreSQL + Prisma**
- **Auth básica com e-mail/senha** usando **bcrypt** e **JWT** em cookie httpOnly.
- Protected route: `/dashboard`.

## Como usar

1. Crie o projeto a partir deste template:
   ```bash
   pnpm i # ou npm/yarn
   cp .env.example .env
   # edite DATABASE_URL e JWT_SECRET
   npx prisma migrate dev --name init
   pnpm dev
   ```

2. Acesse:
   - `/signup` para criar conta
   - `/signin` para entrar
   - `/dashboard` (rota protegida)

## Observações

- Para usar componentes **shadcn/ui**, você pode rodar posteriormente:
  ```bash
  npx shadcn@latest init
  npx shadcn@latest add button input form card
  ```
  O projeto já está com Tailwind configurado; as classes utilitárias usadas imitam o estilo padrão.

## Importação de dados

Fluxo esperado (upload → job → banco):

1. Upload de arquivo cria um **ImportJob** com status `PENDING`, amarrado ao usuário/tenant e metadados da origem (CRM, arquivo).
2. Cada linha passa por normalização (aliases de colunas suportadas: `name/nome`, `email/e-mail`, `phone/telefone`, `crmId`).
3. Validação garante nome e e-mail válidos e telefone mínimo; erros geram log estruturado (`row.validation_failed`) e contam como ignorados.
4. Linhas válidas são mapeadas para contato, registrando criação/atualização conforme presença de `crmId`.
5. Conclusão do job atualiza métricas (duração, taxa de erro, linhas/minuto) e grava trilha de auditoria: quem importou, quando, origem CRM, quantidades criadas/atualizadas/ignoradas.

Limites e boas práticas:

- Tamanho máximo recomendado: **5 MB** ou **10.000 linhas** por job para evitar timeouts.
- Colunas aceitas: `name`, `email`, `phone`, `crmId`; colunas extras são preservadas apenas no log de contexto.
- Use arquivos UTF-8 e quebre o upload em lotes se ultrapassar o limite sugerido.

Procedimento de rollback:

- Em caso de erro ou métricas acima do esperado, marque o job como `FAILED` e reprocessar somente as linhas válidas.
- Logs estruturados (`job.*` e `row.*`) permitem identificar linhas problemáticas; reenvie apenas elas após correção.
- Caso registros tenham sido criados indevidamente, utilize a auditoria (resumo em `ImportJob.auditSummary`) para localizar impactos e realizar exclusão manual ou script de reversão.
