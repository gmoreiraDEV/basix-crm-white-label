'use client';
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [profile, setProfile] = useState<{email: string} | null>(null);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(setProfile).catch(() => setProfile(null));
  }, []);

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
      <p>Você está autenticado{profile ? ` como ${profile.email}` : ""}.</p>
      <form action="/api/auth/logout" method="post" className="mt-6">
        <button className="btn" type="submit">Sair</button>
      </form>
    </div>
  );
}
