"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleX, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api";
import { login, register, type Credentials } from "@/lib/auth";

import AuthField from "./AuthField";
import AuthTabs, { type AuthMode } from "./AuthTabs";

const MIN_PASSWORD = 8;

const COPY = {
  login: {
    title: "Bon retour !",
    subtitle: "Saisissez vos informations pour vous connecter.",
    mobileTitle: "Connexion avec votre e-mail",
    submit: "Se connecter",
    pending: "Connexion…",
    footer: "Pas encore de compte ?",
    footerLink: { href: "/register", label: "S'inscrire" },
  },
  register: {
    title: "Créer votre compte",
    subtitle: "Quelques secondes suffisent pour commencer votre premier album.",
    mobileTitle: "Inscription avec votre e-mail",
    submit: "Créer mon compte",
    pending: "Création du compte…",
    footer: "Déjà un compte ?",
    footerLink: { href: "/login", label: "Se connecter" },
  },
} as const;

type FieldErrors = Partial<Record<"email" | "password", string>>;

function validate(mode: AuthMode, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Saisissez votre adresse e-mail.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = "Cette adresse e-mail ne semble pas valide.";
  if (!password) errors.password = "Saisissez votre mot de passe.";
  else if (mode === "register" && password.length < MIN_PASSWORD)
    errors.password = `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`;
  return errors;
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: async (credentials: Credentials) => {
      if (mode === "login") await login(credentials);
      else await register(credentials);
    },
    onSuccess: () => router.replace("/dashboard"),
    onError: (error) => {
      if (error instanceof ApiError) {
        setFieldErrors({ email: error.fields.email, password: error.fields.password });
      }
    },
  });

  const error = mutation.error;
  // Errors not tied to one field (wrong credentials, network…) are shown under the inputs.
  const formError =
    error && !(error instanceof ApiError && Object.keys(error.fields).length)
      ? error.message
      : null;
  // Wrong email or password: we can't tell which one, so both are flagged.
  const badCredentials = error instanceof ApiError && error.status === 401;

  function edited(field: keyof FieldErrors) {
    if (mutation.error) mutation.reset();
    if (fieldErrors[field]) setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(mode, email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    mutation.mutate({ email: email.trim(), password, remember });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col md:flex-1 md:justify-center">
        <AuthTabs active={mode} />

        <div className="text-center md:mt-8">
          <h1 className="text-[22px] font-medium tracking-tight text-neutral-900 md:text-[28px]">
            <span className="md:hidden">{copy.mobileTitle}</span>
            <span className="hidden md:inline">{copy.title}</span>
          </h1>
          <p className="mt-2 hidden text-neutral-600 md:block">{copy.subtitle}</p>
        </div>

        <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5 md:mt-9">
          <AuthField
            id="email"
            label="Adresse e-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="Saisissez votre adresse e-mail"
            icon={<Mail className="size-6" strokeWidth={2} />}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              edited("email");
            }}
            error={fieldErrors.email}
            invalid={badCredentials}
            describedById={formError ? "form-error" : undefined}
            trailing={
              email && (
                <button
                  type="button"
                  aria-label="Effacer l'adresse e-mail"
                  onClick={() => {
                    setEmail("");
                    edited("email");
                  }}
                  className="rounded-full text-neutral-700 focus-visible:outline-2 focus-visible:outline-neutral-900 md:hidden"
                >
                  <CircleX aria-hidden className="size-6" strokeWidth={2} />
                </button>
              )
            }
          />

          <AuthField
            id="password"
            label="Mot de passe"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="Saisissez votre mot de passe"
            icon={<LockKeyhole className="size-6" strokeWidth={2} />}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              edited("password");
            }}
            error={fieldErrors.password}
            invalid={badCredentials}
            describedById={formError ? "form-error" : undefined}
            hint={mode === "register" ? `${MIN_PASSWORD} caractères minimum.` : undefined}
            trailing={
              <button
                type="button"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-full text-neutral-700 focus-visible:outline-2 focus-visible:outline-neutral-900"
              >
                {showPassword ? (
                  <EyeOff aria-hidden className="size-6 md:size-[18px]" strokeWidth={2} />
                ) : (
                  <Eye aria-hidden className="size-6 md:size-[18px]" strokeWidth={2} />
                )}
              </button>
            }
          />

          {formError && (
            <p id="form-error" role="alert" className="-mt-2 px-5 text-sm text-red-600">
              {formError}
            </p>
          )}

          <label className="-mt-2 flex w-fit cursor-pointer items-center gap-2.5 text-neutral-500 md:-mt-1 md:text-sm md:text-neutral-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-5 rounded accent-neutral-900 md:size-4"
            />
            Se souvenir de moi
          </label>

          <button
            type="submit"
            disabled={mutation.isPending}
            aria-busy={mutation.isPending}
            className="mt-1 flex h-14 items-center justify-center gap-2 rounded-full bg-neutral-900 text-lg font-medium text-white shadow-[0_12px_24px_-10px_rgb(0_0_0/0.45)] transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-70 md:h-12 md:text-base"
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle aria-hidden className="size-5 animate-spin" />
                {copy.pending}
              </>
            ) : (
              <>
                <span className="md:hidden">Continuer</span>
                <span className="hidden md:inline">{copy.submit}</span>
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-neutral-500 md:mt-8 md:text-[15px] md:text-neutral-600">
        {copy.footer}{" "}
        <Link
          href={copy.footerLink.href}
          className="font-medium text-neutral-900 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-neutral-900"
        >
          {copy.footerLink.label}
        </Link>
      </p>
    </div>
  );
}
