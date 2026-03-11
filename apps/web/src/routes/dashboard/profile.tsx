import { useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { User, Mail, Lock, CheckCircle, AlertCircle, X } from "lucide-react";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useRouteContext({ from: "/dashboard" });

  const [name, setName] = useState(user.name ?? "");
  const [nameLoading, setNameLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleUpdateName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameLoading(true);
    setMessage(null);

    const result = await authClient.updateUser({ name });

    setNameLoading(false);

    if (result.error) {
      setMessage({
        type: "error",
        text: result.error.message ?? "Unable to update name.",
      });
    } else {
      setMessage({ type: "success", text: "Name updated." });
    }
  }

  async function handleChangeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailLoading(true);
    setMessage(null);

    if (!newEmail.trim()) {
      setEmailLoading(false);
      setMessage({ type: "error", text: "Please enter a new email address." });
      return;
    }

    const result = await authClient.changeEmail({ newEmail });

    setEmailLoading(false);

    if (result.error) {
      setMessage({
        type: "error",
        text: result.error.message ?? "Unable to change email.",
      });
    } else {
      setMessage({
        type: "success",
        text: "Email change requested. Check your inbox for verification.",
      });
      setNewEmail("");
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordLoading(true);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordLoading(false);
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordLoading(false);
      setMessage({
        type: "error",
        text: "New password must be at least 8 characters.",
      });
      return;
    }

    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    });

    setPasswordLoading(false);

    if (result.error) {
      setMessage({
        type: "error",
        text: result.error.message ?? "Unable to change password.",
      });
    } else {
      setMessage({ type: "success", text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Profile settings
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Manage your account details.
        </p>
      </div>

      {message ? (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Current account info */}
      <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-400">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300">
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-medium text-stone-900 dark:text-stone-100">
              {user.name || "Unnamed"}
            </p>
            <p className="text-xs">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Update name */}
      <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
          <User className="h-4 w-4 text-stone-500 dark:text-stone-400" />
          Name
        </h3>
        <form className="mt-4 grid gap-4" onSubmit={handleUpdateName}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-stone-400"
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={nameLoading}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              {nameLoading ? "Saving..." : "Update name"}
            </button>
          </div>
        </form>
      </div>

      {/* Change email */}
      <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
          <Mail className="h-4 w-4 text-stone-500 dark:text-stone-400" />
          Email
        </h3>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Current: {user.email}
        </p>
        <form className="mt-4 grid gap-4" onSubmit={handleChangeEmail}>
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="New email address"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-stone-400"
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={emailLoading}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              {emailLoading ? "Saving..." : "Change email"}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
          <Lock className="h-4 w-4 text-stone-500 dark:text-stone-400" />
          Password
        </h3>
        <form className="mt-4 grid gap-4" onSubmit={handleChangePassword}>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-stone-400"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-stone-400"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-stone-400"
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              {passwordLoading ? "Saving..." : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
