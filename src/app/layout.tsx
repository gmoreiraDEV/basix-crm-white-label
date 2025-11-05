import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "Helena CRM Starter", description: "Next.js + Postgres + Auth + Tailwind" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="border-b bg-white">
          <div className="container flex items-center justify-between py-3">
            <Link href="/" className="font-semibold">Helena Starter</Link>
            <nav className="space-x-4">
              <Link className="link" href="/signin">Entrar</Link>
              <Link className="link" href="/signup">Criar conta</Link>
              <Link className="link" href="/dashboard">Dashboard</Link>
            </nav>
          </div>
        </header>
        <main className="container py-8">{children}</main>
      </body>
    </html>
  );
}
