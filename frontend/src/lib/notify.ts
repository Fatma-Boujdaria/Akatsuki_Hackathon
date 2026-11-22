import { useEffect, useRef } from "react";
import type { Alert, NotifyPrefs } from "./types";
import { alertText, alertTitle } from "../components/alerts";

// Phone / browser notifications for new alerts.
//
// The app registers a service worker (public/sw.js) and shows a system
// notification for each NEW alert, filtered by the categories the user enabled.
// This works while Tranche Guard is open, even in a background tab or a phone's
// installed web app. Notifications while the app is fully closed need a push
// service (Web Push with VAPID keys, or FCM for the Flutter app): not set up yet.

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!registration) {
    registration =
      "serviceWorker" in navigator
        ? navigator.serviceWorker.register("/sw.js").catch(() => null)
        : Promise.resolve(null);
  }
  return registration;
}

function category(a: Alert): keyof NotifyPrefs {
  if (a.type === "threshold") return "threshold";
  if (a.type === "leak") return "leak";
  return "device";
}

async function show(a: Alert): Promise<void> {
  const title = `Tranche Guard · ${alertTitle(a)}`;
  const options: NotificationOptions = {
    body: alertText(a),
    icon: "/app-icon.svg",
    badge: "/favicon.svg",
    tag: a.id,
    data: { url: a.type === "leak" ? "/eau" : "/alertes" },
  };
  const reg = await registerServiceWorker();
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
}

/** Show a system notification for every alert that appears after the first load. */
export function useAlertNotifications(alerts: Alert[] | undefined, prefs: NotifyPrefs | null | undefined): void {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!alerts) return;
    if (seen.current === null) {
      seen.current = new Set(alerts.map((a) => a.id)); // alerts already there are not "new"
      return;
    }
    const fresh = alerts.filter((a) => !seen.current!.has(a.id));
    fresh.forEach((a) => seen.current!.add(a.id));
    if (!fresh.length || !prefs?.push || notificationPermission() !== "granted") return;
    for (const a of fresh) {
      if (prefs[category(a)] !== false) void show(a);
    }
  }, [alerts, prefs]);
}
