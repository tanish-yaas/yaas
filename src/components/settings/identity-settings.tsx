"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateProfile } from "@/server/actions/profile";
import {
  AVATAR_PREFIX,
  Avatar,
  SPACE_AVATARS,
  SpaceAvatarMark,
} from "@/components/ui/avatar";
import { SettingsPanel } from "./settings-panel";

const MAX_BIO = 280;
const field = "field";

export function IdentitySettings({
  displayName: initialName,
  jobTitle: initialTitle,
  bio: initialBio,
  avatarUrl: initialAvatar,
  signInImage,
}: {
  displayName: string;
  jobTitle: string;
  bio: string;
  avatarUrl: string;
  signInImage: string | null;
}) {
  const [displayName, setDisplayName] = useState(initialName);
  const [jobTitle, setJobTitle] = useState(initialTitle);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setNote(null);
    startTransition(async () => {
      const result = await updateProfile({
        displayName,
        jobTitle,
        bio,
        avatarUrl,
      });
      setNote(result.ok ? "Saved" : result.error);
    });
  }

  const remaining = MAX_BIO - bio.length;

  return (
    <SettingsPanel
      title="Your profile"
      dimmed={pending}
      description="What the rest of the workspace sees when they look you up."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-[0.12em] text-faint">
            Name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={field}
            placeholder="Your name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-[0.12em] text-faint">
            Title
          </label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className={field}
            placeholder="Founder, Designer, Ops…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label className="text-[11px] uppercase tracking-[0.12em] text-faint">
              Bio
            </label>
            <span
              className={`text-[10px] tabular-nums ${
                remaining < 0 ? "text-[var(--status-red)]" : "text-faint"
              }`}
            >
              {remaining}
            </span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className={`${field} resize-none`}
            placeholder="A line or two about what you work on."
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-[0.12em] text-faint">
            Picture
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAvatarUrl("")}
              title="Use your sign-in photo"
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors ${
                avatarUrl === ""
                  ? "border-[var(--primary)]"
                  : "border-transparent hover:border-[color-mix(in_oklab,white_20%,transparent)]"
              }`}
            >
              <Avatar image={signInImage} name={displayName} size={36} />
            </button>

            {SPACE_AVATARS.map((avatar) => {
              const value = `${AVATAR_PREFIX}${avatar.key}`;
              const selected = avatarUrl === value;

              return (
                <button
                  key={avatar.key}
                  type="button"
                  onClick={() => setAvatarUrl(value)}
                  title={avatar.label}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors ${
                    selected
                      ? "border-[var(--primary)]"
                      : "border-transparent hover:border-[color-mix(in_oklab,white_20%,transparent)]"
                  }`}
                >
                  <SpaceAvatarMark avatarKey={avatar.key} size={36} />
                  {selected && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)]">
                      <Check size={10} className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-faint">
            {avatarUrl === ""
              ? "Using your Google sign-in photo."
              : `Using the ${
                  SPACE_AVATARS.find(
                    (a) => `${AVATAR_PREFIX}${a.key}` === avatarUrl
                  )?.label ?? "selected"
                } avatar.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending || remaining < 0 || displayName.trim() === ""}
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Save profile
          </button>
          {note && <span className="text-[12px] text-faint">{note}</span>}
        </div>
      </div>
    </SettingsPanel>
  );
}
