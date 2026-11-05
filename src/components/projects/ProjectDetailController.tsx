"use client";

import { useEffect, useRef } from "react";

/** The query parameter that names the open project, so the browser Back closes it. */
export const PROJECT_PARAM = "project";

type DetailState = { projectDetail: string };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function dialogFor(slug: string): HTMLDialogElement | null {
  const el = document.querySelector(`dialog[data-project-detail="${CSS.escape(slug)}"]`);
  return el instanceof HTMLDialogElement ? el : null;
}

function urlWith(slug: string | null): string {
  const url = new URL(window.location.href);
  if (slug) url.searchParams.set(PROJECT_PARAM, slug);
  else url.searchParams.delete(PROJECT_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

function slugInUrl(): string | null {
  return new URLSearchParams(window.location.search).get(PROJECT_PARAM);
}

/**
 * Opens and closes the server-rendered project detail dialogs. Any element
 * with `data-project-open="<slug>"` opens that product's dialog (showModal:
 * the page behind is inert), pushes `?project=<slug>` so the browser Back
 * closes it, moves focus to the Back button and keeps Tab inside the dialog.
 * The Back button, Esc and the browser Back all close it and return focus to
 * the element that opened it. A `?project=` in the URL on load opens it too.
 */
export default function ProjectDetailController() {
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const openDialog = (slug: string, push: boolean) => {
      const dialog = dialogFor(slug);
      if (!dialog || dialog.open) return;
      for (const other of document.querySelectorAll<HTMLDialogElement>("dialog.pd[open]")) {
        other.close();
      }
      if (push) {
        const state: DetailState = { projectDetail: slug };
        window.history.pushState({ ...(window.history.state ?? {}), ...state }, "", urlWith(slug));
      }
      dialog.showModal();
      dialog.scrollTop = 0;
      dialog.querySelector<HTMLElement>("[data-project-close]")?.focus();
    };

    /** Closes from inside the page: undo our history entry, else just drop the param. */
    const requestClose = (dialog: HTMLDialogElement) => {
      const slug = dialog.dataset.projectDetail;
      const state = window.history.state as Partial<DetailState> | null;
      if (state?.projectDetail === slug && slugInUrl() === slug) {
        window.history.back();
        return;
      }
      dialog.close();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const open = target?.closest<HTMLElement>("[data-project-open]");
      if (open) {
        event.preventDefault();
        opener.current = open;
        openDialog(open.dataset.projectOpen ?? "", true);
        return;
      }
      const close = target?.closest<HTMLElement>("[data-project-close]");
      const dialog = close?.closest<HTMLDialogElement>("dialog.pd");
      if (dialog) requestClose(dialog);
    };

    const onCancel = (event: Event) => {
      const dialog = event.target;
      if (!(dialog instanceof HTMLDialogElement) || !dialog.classList.contains("pd")) return;
      event.preventDefault();
      requestClose(dialog);
    };

    /** After any close: drop the param if it is still there, and give focus back. */
    const onClose = (event: Event) => {
      const dialog = event.target;
      if (!(dialog instanceof HTMLDialogElement) || !dialog.classList.contains("pd")) return;
      if (slugInUrl() === dialog.dataset.projectDetail) {
        window.history.replaceState(window.history.state, "", urlWith(null));
      }
      const back =
        opener.current ??
        Array.from(
          document.querySelectorAll<HTMLElement>(
            `[data-project-open="${CSS.escape(dialog.dataset.projectDetail ?? "")}"]`,
          ),
        ).find((el) => el.offsetParent !== null);
      opener.current = null;
      back?.focus({ preventScroll: false });
    };

    const onPopState = () => {
      const slug = slugInUrl();
      for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog.pd[open]")) {
        if (dialog.dataset.projectDetail !== slug) dialog.close();
      }
      if (slug) openDialog(slug, false);
    };

    /** Keeps Tab and Shift+Tab inside the open dialog. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLDialogElement>("dialog.pd[open]");
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("click", onClick);
    document.addEventListener("cancel", onCancel, true);
    document.addEventListener("close", onClose, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);

    const initial = slugInUrl();
    if (initial) openDialog(initial, false);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("cancel", onCancel, true);
      document.removeEventListener("close", onClose, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return null;
}
