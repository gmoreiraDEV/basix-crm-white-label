'use client';
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
});

type FormData = z.infer<typeof schema>;

export default function SignUpPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) window.location.href = '/signin';
    else setServerError((await res.json()).error || 'Falha ao criar conta');
  };

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-4">Criar conta</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" type="text" {...register('name')} />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" {...register('email')} />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Senha</label>
          <input className="input" type="password" {...register('password')} />
          {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
        </div>
        {serverError && <p className="text-red-600 text-sm">{serverError}</p>}
        <button className="btn" disabled={isSubmitting} type="submit">{isSubmitting ? 'Criando...' : 'Criar conta'}</button>
      </form>
    </div>
  );
}
