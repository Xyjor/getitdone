"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type Props = Omit<React.ComponentProps<typeof Button>, "onClick"> & { label?: string };

/** Signs the visitor into a fresh sandbox account with sample data. */
export function DemoButton({ label = "Try the demo", size = "lg", ...props }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function startDemo() {
    setPending(true);
    try {
      await api("/api/auth/demo", { method: "POST" });
      router.push("/app/today");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the demo");
      setPending(false);
    }
  }

  return (
    <Button type="button" size={size} onClick={startDemo} disabled={pending} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {label}
    </Button>
  );
}
