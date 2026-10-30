"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import AuthField from "@/components/auth/AuthField";
import { ApiError } from "@/lib/api";
import { changePassword, updateMe, type User } from "@/lib/auth";
import { ME_QUERY_KEY } from "@/lib/useCurrentUser";

const MIN_PASSWORD = 8;

export function ProfileForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<Partial<Record<"name" | "email", string>>>({});

  const mutation = useMutation({
    mutationFn: () => updateMe({ name: name.trim(), email: email.trim() }),
    onSuccess: (updated) => queryClient.setQueryData(ME_QUERY_KEY, updated),
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fields);
    },
  });

  const changed = name.trim() !== user.name || email.trim().toLowerCase() !== user.email;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Cette adresse e-mail ne semble pas valide.";
    setErrors(next);
    if (!Object.keys(next).length) mutation.mutate();
  }

  const formError =
    mutation.error &&
    !(mutation.error instanceof ApiError && Object.keys(mutation.error.fields).length)
      ? mutation.error.message
      : null;

  return (
    <Form onSubmit={onSubmit}>
      <AuthField
        id="name"
        label="Nom affiché"
        autoComplete="name"
        placeholder="Votre nom"
        icon={<UserRound className="size-6" strokeWidth={2} />}
        value={name}
        maxLength={120}
        onChange={(e) => {
          setName(e.target.value);
          mutation.reset();
        }}
        error={errors.name}
      />
      <AuthField
        id="email"
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="Votre adresse e-mail"
        icon={<Mail className="size-6" strokeWidth={2} />}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErrors((current) => ({ ...current, email: undefined }));
          mutation.reset();
        }}
        error={errors.email}
      />
      <Feedback error={formError} success={mutation.isSuccess && "Modifications enregistrées."} />
      <SubmitButton pending={mutation.isPending} disabled={!changed} label="Enregistrer" />
    </Form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<"current_password" | "new_password", string>>
  >({});

  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fields);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current_password = "Saisissez votre mot de passe actuel.";
    if (next.length < MIN_PASSWORD)
      found.new_password = `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`;
    setErrors(found);
    if (!Object.keys(found).length) mutation.mutate();
  }

  function edited(field: keyof typeof errors) {
    mutation.reset();
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  const formError =
    mutation.error &&
    !(mutation.error instanceof ApiError && Object.keys(mutation.error.fields).length)
      ? mutation.error.message
      : null;

  const toggle = (
    <button
      type="button"
      aria-label={visible ? "Masquer les mots de passe" : "Afficher les mots de passe"}
      aria-pressed={visible}
      onClick={() => setVisible((v) => !v)}
      className="rounded-full text-neutral-700 focus-visible:outline-2 focus-visible:outline-neutral-900"
    >
      {visible ? (
        <EyeOff aria-hidden className="size-6 md:size-[18px]" strokeWidth={2} />
      ) : (
        <Eye aria-hidden className="size-6 md:size-[18px]" strokeWidth={2} />
      )}
    </button>
  );

  return (
    <Form onSubmit={onSubmit}>
      <AuthField
        id="current-password"
        label="Mot de passe actuel"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Votre mot de passe actuel"
        icon={<LockKeyhole className="size-6" strokeWidth={2} />}
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          edited("current_password");
        }}
        error={errors.current_password}
        trailing={toggle}
      />
      <AuthField
        id="new-password"
        label="Nouveau mot de passe"
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        placeholder="Votre nouveau mot de passe"
        icon={<LockKeyhole className="size-6" strokeWidth={2} />}
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          edited("new_password");
        }}
        error={errors.new_password}
        hint={`${MIN_PASSWORD} caractères minimum.`}
      />
      <Feedback error={formError} success={mutation.isSuccess && "Mot de passe mis à jour."} />
      <SubmitButton
        pending={mutation.isPending}
        disabled={!current || !next}
        label="Changer le mot de passe"
      />
    </Form>
  );
}

function Form({
  onSubmit,
  children,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {children}
    </form>
  );
}

function Feedback({ error, success }: { error: string | null; success: string | false }) {
  if (error)
    return (
      <p role="alert" className="-mt-2 px-5 text-sm text-red-600">
        {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className="-mt-2 px-5 text-sm text-emerald-700">
        {success}
      </p>
    );
  return null;
}

function SubmitButton({
  pending,
  disabled,
  label,
}: {
  pending: boolean;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 text-lg font-medium text-white shadow-[0_12px_24px_-10px_rgb(0_0_0/0.45)] transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none md:h-12 md:text-base"
    >
      {pending && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
      {label}
    </button>
  );
}
