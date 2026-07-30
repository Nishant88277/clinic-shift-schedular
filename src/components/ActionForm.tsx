"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

type ActionResult = { ok: true; batchId?: string } | { ok: false; error: string };

export function ActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  onSuccess?: (result: { ok: true; batchId?: string }) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await action(fd);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onSuccess?.(result);
          router.refresh();
        });
      }}
    >
      {children}
      {error && <div className="error">{error}</div>}
      {pending && <p className="muted">Working…</p>}
    </form>
  );
}
