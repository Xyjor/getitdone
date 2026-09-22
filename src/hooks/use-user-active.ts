"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the user has interacted with the page recently. Background polling pauses once this
 * turns false, so an idle tab stops hitting the API and the database can scale to zero (which
 * keeps the free tiers free). Any input flips it back to true and polling resumes.
 */
const IDLE_AFTER_MS = 5 * 60 * 1000;
const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "focus"] as const;

let active = true;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === active) return;
  active = next;
  listeners.forEach((l) => l());
}

function onActivity() {
  set(true);
  clearTimeout(timer);
  timer = setTimeout(() => set(false), IDLE_AFTER_MS);
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    onActivity();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearTimeout(timer);
    }
  };
}

export function useUserActive() {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => true,
  );
}
