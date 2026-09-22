"use client";

import { Check, Inbox, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyInvites, useRespondToInvite } from "@/hooks/use-sharing";
import { LIST_COLOR_CLASSES } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onNavigate?: () => void };

export function InvitationsDialog({ open, onOpenChange, onNavigate }: Props) {
  const router = useRouter();
  const { data: invites = [] } = useMyInvites();
  const respond = useRespondToInvite();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitations</DialogTitle>
          <DialogDescription>Lists other people want to share with you.</DialogDescription>
        </DialogHeader>

        {invites.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
            <Inbox className="mb-2 size-8" />
            No pending invitations.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 p-3">
                <span className={cn("size-3 shrink-0 rounded-full", LIST_COLOR_CLASSES[inv.listColor])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.listName}</p>
                  <p className="text-xs text-muted-foreground">
                    From {inv.invitedByName} · {inv.role === "EDITOR" ? "Can edit" : "Can view"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Decline ${inv.listName}`}
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ invite: inv, accept: false })}
                >
                  <X />
                </Button>
                <Button
                  size="sm"
                  disabled={respond.isPending}
                  onClick={() =>
                    respond.mutate(
                      { invite: inv, accept: true },
                      {
                        onSuccess: () => {
                          onOpenChange(false);
                          onNavigate?.();
                          router.push(`/app/lists/${inv.listId}`);
                        },
                      },
                    )
                  }
                >
                  <Check /> Accept
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
