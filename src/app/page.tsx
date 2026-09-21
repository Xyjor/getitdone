import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Flag,
  GripVertical,
  Lock,
  Moon,
  Smartphone,
  Zap,
} from "lucide-react";
import { DemoButton } from "@/components/auth/demo-button";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Lock, title: "Secure by default", text: "JWT sessions in httpOnly cookies, bcrypt-hashed passwords, per-user data isolation." },
  { icon: Zap, title: "Instant feedback", text: "Optimistic updates make every click feel immediate, with automatic rollback on errors." },
  { icon: GripVertical, title: "Drag to reorder", text: "Prioritize by dragging tasks, with full keyboard and touch support." },
  { icon: CalendarDays, title: "Smart views", text: "Today, Upcoming and Completed views, plus full-text search across every list." },
  { icon: Smartphone, title: "Works everywhere", text: "A responsive layout that feels at home on a phone, tablet or widescreen monitor." },
  { icon: Moon, title: "Dark mode", text: "Follows your system theme, or pick light or dark yourself." },
];

const STACK = ["Next.js 16", "React 19", "TypeScript", "PostgreSQL", "Prisma", "Tailwind CSS", "TanStack Query", "Zod", "Vitest", "Playwright"];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            {user ? (
              <Button asChild>
                <Link href="/app">
                  Open app <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Sign up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
          />
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-green-500" /> Open source portfolio project
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Less juggling. <span className="text-primary">Get it done.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
              GetItDone is a fast, focused task manager. Group tasks into lists, set due dates and
              priorities, and drag things into the order that makes sense to you.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {user ? (
                <Button asChild size="lg" className="h-11 px-5">
                  <Link href="/app">
                    Go to your tasks <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <>
                  <DemoButton className="h-11 px-5" label="Try the live demo" />
                  <Button asChild size="lg" variant="outline" className="h-11 px-5">
                    <Link href="/register">Create a free account</Link>
                  </Button>
                </>
              )}
            </div>
            {!user && (
              <p className="mt-3 text-xs text-muted-foreground">
                The demo creates a private sandbox with sample data. No sign-up needed.
              </p>
            )}
          </div>

          <AppPreview />
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6">
                <div className="mb-4 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
            <h2 className="text-sm font-medium text-muted-foreground">Built with</h2>
            <ul className="mt-5 flex flex-wrap justify-center gap-2">
              {STACK.map((s) => (
                <li key={s} className="rounded-full border bg-background px-3 py-1 text-sm">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} GetItDone</p>
        <p>A full-stack portfolio project.</p>
      </footer>
    </div>
  );
}

/** Static illustration of the app, built with markup so it stays crisp and theme-aware. */
function AppPreview() {
  const tasks = [
    { title: "Prepare sprint demo", meta: "Today", priority: "High", color: "bg-blue-500", done: false },
    { title: "Review pull requests", meta: "Today", color: "bg-blue-500", done: false },
    { title: "Call mom", meta: "Today", priority: "High", color: "bg-green-500", done: false },
    { title: "Set up CI pipeline", color: "bg-blue-500", done: true },
  ];
  const lists = [
    { name: "Work", color: "bg-blue-500", count: 5 },
    { name: "Personal", color: "bg-green-500", count: 3 },
    { name: "Groceries", color: "bg-amber-500", count: 3 },
    { name: "Learning", color: "bg-violet-500", count: 1 },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6" aria-hidden>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
        <div className="flex h-9 items-center gap-1.5 border-b bg-muted/50 px-4">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex text-left">
          <div className="hidden w-56 shrink-0 border-r bg-sidebar p-4 sm:block">
            <div className="space-y-1 text-sm">
              <div className="rounded-md bg-sidebar-accent px-2 py-1.5 font-medium">Today</div>
              <div className="px-2 py-1.5 text-muted-foreground">Upcoming</div>
              <div className="px-2 py-1.5 text-muted-foreground">Completed</div>
            </div>
            <p className="mt-5 mb-1 px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Lists</p>
            <div className="space-y-1 text-sm">
              {lists.map((l) => (
                <div key={l.name} className="flex items-center gap-2 px-2 py-1.5">
                  <span className={cn("size-2 rounded-full", l.color)} />
                  {l.name}
                  <span className="ml-auto text-xs text-muted-foreground">{l.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 p-5 sm:p-8">
            <p className="text-xl font-semibold">Today</p>
            <p className="text-xs text-muted-foreground">Your day at a glance</p>
            <ul className="mt-5 space-y-2">
              {tasks.map((t) => (
                <li key={t.title} className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5">
                  <span
                    className={cn(
                      "grid size-4.5 place-items-center rounded-full border",
                      t.done && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {t.done && <Check className="size-3" />}
                  </span>
                  <span className="flex-1">
                    <span className={cn("block text-sm", t.done && "text-muted-foreground line-through")}>
                      {t.title}
                    </span>
                    {(t.meta || t.priority) && (
                      <span className="mt-0.5 flex gap-3 text-[11px]">
                        {t.meta && <span className="text-primary">{t.meta}</span>}
                        {t.priority && (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <Flag className="size-2.5" /> {t.priority}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className={cn("size-2 rounded-full", t.color)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
