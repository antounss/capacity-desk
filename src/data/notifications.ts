// Hands the planned notifications to Android. All decisions about what to schedule
// are made in src/domain/notifications.ts; this file only talks to the plugin.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { PlannedNotification } from '../domain/notifications';

const CHANNELS = {
  training: { id: 'training', name: 'Training reminders', description: 'A reminder before each planned session' },
  conflict: { id: 'conflicts', name: 'Conflict alerts', description: 'A morning summary of conflicts in your week' },
};

export const notificationsSupported = Capacitor.isNativePlatform();

/** Asks Android for permission. Called only when the user switches a notification on. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  const asked = await LocalNotifications.requestPermissions();
  return asked.display === 'granted';
}

function toDate(n: PlannedNotification): Date {
  const [y, m, d] = n.date.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(n.minute / 60), n.minute % 60);
}

/** Replaces every pending notification with the planned list. */
export async function syncNotifications(planned: PlannedNotification[]): Promise<void> {
  if (!notificationsSupported) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  if (planned.length === 0) return;
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;

  for (const channel of Object.values(CHANNELS)) {
    await LocalNotifications.createChannel({ ...channel, importance: 3 });
  }
  await LocalNotifications.schedule({
    notifications: planned.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      channelId: CHANNELS[n.kind].id,
      // Inexact on purpose. The plugin's default is an exact alarm, which makes Android
      // open its "Alarms & reminders" settings screen. A reminder that arrives a few
      // minutes late does not justify asking for that permission.
      isExactNotification: false,
      schedule: { at: toDate(n), allowWhileIdle: true },
    })),
  });
}
