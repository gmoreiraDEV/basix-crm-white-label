import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Helena CRM Starter",
  description: "Next.js + Postgres + Auth + Tailwind",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning={true} data-lt-installed="true">
      <body className="w-full">
        <header className="border-b bg-white">
          <div className="flex items-center justify-between py-3 mx-8">
            <Link href="/" className="font-semibold">
              CRM
            </Link>
            <nav className="space-x-4">
              <Link className="link" href="/signin">
                Entrar
              </Link>
              <Link className="link" href="/signup">
                Criar conta
              </Link>
              <Link className="link" href="/dashboard">
                Dashboard
              </Link>
            </nav>
          </div>
        </header>
        <main className="py-8 m-8">{children}</main>
      </body>
    </html>
  );
}
