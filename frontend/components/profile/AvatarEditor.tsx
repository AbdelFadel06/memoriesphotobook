"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImageUp, LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import UserAvatar from "@/components/ui/UserAvatar";
import { AVATAR_MAX_BYTES, AVATAR_TYPES, removeAvatar, uploadAvatar, type User } from "@/lib/auth";
import { ME_QUERY_KEY } from "@/lib/useCurrentUser";

/** Avatar with a camera button: add a picture, or change / remove the current one. */
export default function AvatarEditor({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSaved = (updated: User) => queryClient.setQueryData(ME_QUERY_KEY, updated);
  const onFailed = (e: Error) => setError(e.message);
  const upload = useMutation({ mutationFn: uploadAvatar, onSuccess: onSaved, onError: onFailed });
  const remove = useMutation({ mutationFn: removeAvatar, onSuccess: onSaved, onError: onFailed });
  const busy = upload.isPending || remove.isPending;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function pick() {
    setOpen(false);
    input.current?.click();
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      setError("Choisissez une photo au format JPEG, PNG, WebP ou HEIC.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("La photo ne doit pas dépasser 5 Mo.");
      return;
    }
    upload.mutate(file);
  }

  return (
    <div className="relative" ref={menu}>
      <div className="relative">
        <span className="block rounded-full ring-4 ring-white/15">
          <UserAvatar name={user.name} email={user.email} avatarUrl={user.avatar_url} size="hero" />
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
            <LoaderCircle aria-label="Envoi en cours" className="size-7 animate-spin text-white" />
          </span>
        )}
        <button
          type="button"
          disabled={busy}
          aria-label="Modifier la photo de profil"
          aria-haspopup={user.avatar_url ? "menu" : undefined}
          aria-expanded={user.avatar_url ? open : undefined}
          onClick={() => (user.avatar_url ? setOpen((v) => !v) : pick())}
          className="absolute -right-1 -bottom-1 grid size-8 place-items-center lg:size-10 rounded-full bg-white text-neutral-900 shadow-md ring-2 ring-neutral-950 transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
        >
          <Camera aria-hidden className="size-4" strokeWidth={2} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-3 w-60 rounded-2xl bg-white py-1.5 text-neutral-900 shadow-xl ring-1 ring-black/5"
        >
          <MenuItem onClick={pick} icon={<ImageUp className="size-5" strokeWidth={2} />}>
            Changer la photo
          </MenuItem>
          <MenuItem
            danger
            onClick={() => {
              setOpen(false);
              setError(null);
              remove.mutate();
            }}
            icon={<Trash2 className="size-5" strokeWidth={2} />}
          >
            Supprimer la photo
          </MenuItem>
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        onChange={onFile}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      {error && (
        <p role="alert" className="absolute top-full left-0 mt-3 w-72 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  danger,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left font-medium hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none ${
        danger ? "text-red-600" : ""
      }`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}
