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
