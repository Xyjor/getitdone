"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  CalendarDays,
  CheckCircle2,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  type LucideIcon,
  CalendarClock,
  Mail,
  LogOut as LeaveIcon,
  Users,
} from "lucide-react";
import { InvitationsDialog } from "@/components/sharing/invitations-dialog";
import { useMyInvites, useRemoveMember } from "@/hooks/use-sharing";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteList, useLists } from "@/hooks/use-lists";
import { api } from "@/lib/api-client";
import type { ListDTO, UserDTO } from "@/lib/types";
import { LIST_COLOR_CLASSES, initials } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { ListDialog } from "./list-dialog";

const VIEWS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app/today", label: "Today", icon: CalendarDays },
  { href: "/app/upcoming", label: "Upcoming", icon: CalendarClock },
  { href: "/app/completed", label: "Completed", icon: CheckCircle2 },
];

type Props = { user: UserDTO; onNavigate?: () => void };

export function Sidebar({ user, onNavigate }: Props) {
  const pathname = usePathname();
  const { data: lists, isPending } = useLists();
  const { data: invites = [] } = useMyInvites();
  const [createOpen, setCreateOpen] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const myLists = lists?.filter((l) => l.role === "OWNER");
  const sharedWithMe = lists?.filter((l) => l.role !== "OWNER") ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo href="/app" />
      </div>

      <div className="px-3 pb-2">
        <Suspense fallback={<Skeleton className="h-8 w-full" />}>
          <SearchBox onNavigate={onNavigate} />
        </Suspense>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        <ul className="space-y-0.5">
          {VIEWS.map((v) => (
            <li key={v.href}>
              <NavLink href={v.href} active={pathname === v.href} onNavigate={onNavigate}>
                <v.icon className="size-4 text-muted-foreground" />
                {v.label}
              </NavLink>
            </li>
          ))}
          {invites.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setInvitesOpen(true)}
                className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-sm font-medium transition-colors hover:bg-sidebar-accent"
              >
                <Mail className="size-4 text-muted-foreground" />
                Invitations
                <span className="ml-auto rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
                  {invites.length}
                </span>
              </button>
            </li>
          )}
        </ul>

        <div className="mt-6 mb-1 flex items-center justify-between px-2">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            My lists
          </h2>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCreateOpen(true)}
            aria-label="Create list"
          >
            <Plus />
          </Button>
        </div>

        <ul className="space-y-0.5">
          {isPending &&
            Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="px-2 py-1.5">
                <Skeleton className="h-5 w-full" />
              </li>
            ))}
          {myLists?.map((list) => (
            <ListNavItem
              key={list.id}
              list={list}
              active={pathname === `/app/lists/${list.id}`}
              onNavigate={onNavigate}
            />
          ))}
          {myLists?.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">No lists yet.</li>
          )}
        </ul>

        <Button
          variant="ghost"
          className="mt-1 w-full justify-start text-muted-foreground"
          onClick={() => setCreateOpen(true)}
        >
          <Plus /> New list
        </Button>

        {sharedWithMe.length > 0 && (
          <>
            <h2 className="mt-6 mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Shared with me
            </h2>
            <ul className="space-y-0.5">
              {sharedWithMe.map((list) => (
                <ListNavItem
                  key={list.id}
                  list={list}
                  userId={user.id}
                  active={pathname === `/app/lists/${list.id}`}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </>
        )}
      </nav>

      <div className="border-t p-3">
        <UserMenu user={user} />
      </div>

      <ListDialog open={createOpen} onOpenChange={setCreateOpen} />
      <InvitationsDialog open={invitesOpen} onOpenChange={setInvitesOpen} onNavigate={onNavigate} />
    </div>
  );
}

function NavLink({
  href,
  active,
  onNavigate,
  children,
  className,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm font-medium transition-colors hover:bg-sidebar-accent",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function ListNavItem({
  list,
  userId,
  active,
  onNavigate,
}: {
  list: ListDTO;
  /** Needed for shared lists (to leave them). */
  userId?: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const deleteList = useDeleteList();
  const leave = useRemoveMember(list.id);
  const isOwner = list.role === "OWNER";

  return (
    <li className="group/list relative">
      <NavLink
        href={`/app/lists/${list.id}`}
        active={active}
        onNavigate={onNavigate}
        className="pr-9"
      >
        <span className={cn("size-2.5 shrink-0 rounded-full", LIST_COLOR_CLASSES[list.color])} />
        <span className="truncate">{list.name}</span>
        {isOwner && list.memberCount > 0 && (
          <>
            <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">(shared)</span>
          </>
        )}
        {list.openCount > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums group-focus-within/list:opacity-0 group-hover/list:opacity-0">
            {list.openCount}
          </span>
        )}
      </NavLink>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-hover/list:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
            aria-label={`Options for ${list.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          {isOwner ? (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil /> Edit list
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 /> Delete list
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setLeaveOpen(true)}>
              <LeaveIcon /> Leave list
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!isOwner && userId && (
        <ConfirmDialog
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          title={`Leave "${list.name}"?`}
          description={`You'll lose access until ${list.ownerName} invites you again.`}
          confirmLabel="Leave list"
          onConfirm={() =>
            leave.mutate(userId, {
              onSuccess: () => {
                if (active) router.push("/app/today");
              },
            })
          }
        />
      )}

      {isOwner && <ListDialog open={editOpen} onOpenChange={setEditOpen} list={list} />}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${list.name}"?`}
        description="This list and all of its tasks will be permanently deleted. This can't be undone."
        confirmLabel="Delete list"
        onConfirm={() =>
          deleteList.mutate(list.id, {
            onSuccess: () => {
              if (active) router.push("/app/today");
            },
          })
        }
      />
    </li>
  );
}

function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = pathname === "/app/search" ? (searchParams.get("q") ?? "") : "";

  return (
    <form
      role="search"
      key={current}
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        if (!q) return;
        router.push(`/app/search?q=${encodeURIComponent(q)}`);
        onNavigate?.();
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="q"
        type="search"
        defaultValue={current}
        placeholder="Search tasks…"
        aria-label="Search tasks"
        className="bg-background pl-8"
        maxLength={100}
      />
    </form>
  );
}

function UserMenu({ user }: { user: UserDTO }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    qc.clear();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-sidebar-accent">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
