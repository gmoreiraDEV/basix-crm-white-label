"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { simpleZodResolver } from "@/lib/simpleZodResolver";

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
  tenantName: z.string().min(2, "Informe o nome da empresa ou workspace"),
});

type FormData = z.infer<typeof schema>;

export default function SignUpPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: simpleZodResolver(schema) });
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        window.location.href = "/signin";
        return;
      }
      let errorMessage = "Falha ao criar conta";
      setServerError(JSON.stringify(res));
    } catch (err) {
      console.error(err);
      setServerError("Erro de conexão. Tente novamente.");
    }
  };

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-4">Criar conta</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" type="text" {...register("name")} />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" {...register("email")} />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="label">Senha</label>
          <input className="input" type="password" {...register("password")} />
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">
              {errors.password.message}
            </p>
          )}
        </div>
        <div>
          <label className="label">Nome da empresa</label>
          <input className="input" type="text" {...register("tenantName")} />
          {errors.tenantName && (
            <p className="text-red-600 text-sm mt-1">
              {errors.tenantName.message}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Criaremos o workspace no plano Básico e habilitaremos plugins do
            plano.
          </p>
        </div>
        {serverError && <p className="text-red-600 text-sm">{serverError}</p>}
        <button className="btn" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Criando..." : "Criar conta"}
        </button>
      </form>
    </div>
  );
}
