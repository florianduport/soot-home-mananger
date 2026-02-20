import { Prisma } from "@prisma/client";
import { format, isSameDay, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { getAppBaseUrl, sendEmail } from "@/lib/email";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettingsData,
} from "@/lib/notification-settings";

type NotificationOptions = {
  userId: string;
  houseId: string;
  taskId?: string | null;
  type:
    | "TASK_ASSIGNED"
    | "TASK_COMMENTED"
    | "TASK_STATUS"
    | "TASK_REMINDER"
    | "TASK_ESCALATION"
    | "PROJECT_CREATED"
    | "INVITE_ACCEPTED";
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  dedupeKey?: string | null;
  sendEmail?: boolean;
  bypassQuietHours?: boolean;
  bypassSchedule?: boolean;
};

function isNotificationUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function isNotificationSettingsUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

type NotificationSettings = NotificationSettingsData;

function resolveWeekday(date: Date) {
  const day = date.getDay();
  if (day === 0) return "SUN";
  if (day === 1) return "MON";
  if (day === 2) return "TUE";
  if (day === 3) return "WED";
  if (day === 4) return "THU";
  if (day === 5) return "FRI";
  return "SAT";
}

function isWithinWindow(minutes: number, start: number, end: number) {
  if (start === end) {
    return true;
  }
  if (start < end) {
    return minutes >= start && minutes < end;
  }
  return minutes >= start || minutes < end;
}

async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  try {
    const settings = await prisma.userNotificationSettings.findUnique({
      where: { userId },
      select: {
        quietHoursEnabled: true,
        quietHoursStartMinutes: true,
        quietHoursEndMinutes: true,
        scheduleEnabled: true,
        scheduleDays: true,
        scheduleStartMinutes: true,
        scheduleEndMinutes: true,
        escalationEnabled: true,
        escalationDelayHours: true,
      },
    });

    if (!settings) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    return {
      quietHoursEnabled: settings.quietHoursEnabled,
      quietHoursStartMinutes: settings.quietHoursStartMinutes,
      quietHoursEndMinutes: settings.quietHoursEndMinutes,
      scheduleEnabled: settings.scheduleEnabled,
      scheduleDays:
        settings.scheduleDays.length > 0
          ? (settings.scheduleDays as NotificationSettings["scheduleDays"])
          : DEFAULT_NOTIFICATION_SETTINGS.scheduleDays,
      scheduleStartMinutes: settings.scheduleStartMinutes,
      scheduleEndMinutes: settings.scheduleEndMinutes,
      escalationEnabled: settings.escalationEnabled,
      escalationDelayHours: settings.escalationDelayHours,
    };
  } catch (error) {
    if (isNotificationSettingsUnavailableError(error)) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
    throw error;
  }
}

async function shouldSendEmailNow(options: {
  userId: string;
  bypassQuietHours?: boolean;
  bypassSchedule?: boolean;
}) {
  const settings = await getNotificationSettings(options.userId);
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const day = resolveWeekday(now);

  if (settings.scheduleEnabled && !options.bypassSchedule) {
    if (!settings.scheduleDays.includes(day)) {
      return false;
    }
    if (!isWithinWindow(minutes, settings.scheduleStartMinutes, settings.scheduleEndMinutes)) {
      return false;
    }
  }

  if (settings.quietHoursEnabled && !options.bypassQuietHours) {
    if (isWithinWindow(minutes, settings.quietHoursStartMinutes, settings.quietHoursEndMinutes)) {
      return false;
    }
  }

  return true;
}

function resolveNotificationUrl(linkUrl?: string | null) {
  const baseUrl = getAppBaseUrl();
  if (!linkUrl) return baseUrl;
  try {
    return new URL(linkUrl, `${baseUrl}/`).toString();
  } catch {
    return baseUrl;
  }
}

async function maybeSendNotificationEmail(
  notificationId: string,
  userId: string,
  title: string,
  body?: string | null,
  linkUrl?: string | null
) {
  let userEmail: string | null = null;
  let userName: string | null = null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    userEmail = user?.email ?? null;
    userName = user?.name ?? null;
  } catch (error) {
    if (isNotificationUnavailableError(error)) {
      return;
    }
    throw error;
  }

  if (!userEmail) return;

  const link = resolveNotificationUrl(linkUrl);
  const greeting = userName ? `Bonjour ${userName},` : "Bonjour,";
  const summary = body ? `\n\n${body}` : "";

  try {
    const delivered = await sendEmail({
      to: userEmail,
      subject: title,
      text: `${greeting}\n\n${title}${summary}\n\nOuvrir: ${link}`,
      html: [
        `<p>${greeting}</p>`,
        `<p><strong>${title}</strong></p>`,
        body ? `<p>${body}</p>` : "",
        `<p><a href="${link}">Ouvrir dans Homanager</a></p>`,
      ]
        .filter(Boolean)
        .join(""),
    });

    if (delivered) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { emailSentAt: new Date() },
      });
    }
  } catch (error) {
    console.warn("Impossible d'envoyer l'email de notification.", error);
  }
}

export async function createNotification(options: NotificationOptions) {
  try {
    if (options.dedupeKey) {
      const existing = await prisma.notification.findUnique({
        where: { dedupeKey: options.dedupeKey },
      });
      if (existing) {
        return existing;
      }
    }

    const notification = await prisma.notification.create({
      data: {
        userId: options.userId,
        houseId: options.houseId,
        taskId: options.taskId ?? undefined,
        type: options.type,
        title: options.title,
        body: options.body,
        linkUrl: options.linkUrl,
        dedupeKey: options.dedupeKey ?? undefined,
      },
    });

    if (
      options.sendEmail &&
      (await shouldSendEmailNow({
        userId: options.userId,
        bypassQuietHours: options.bypassQuietHours,
        bypassSchedule: options.bypassSchedule,
      }))
    ) {
      await maybeSendNotificationEmail(
        notification.id,
        options.userId,
        options.title,
        options.body,
        options.linkUrl
      );
    }

    return notification;
  } catch (error) {
    if (isNotificationUnavailableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function notifyTaskAssigned(options: {
  houseId: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  actorId: string;
  bypassQuietHours?: boolean;
  bypassSchedule?: boolean;
}) {
  if (options.assigneeId === options.actorId) return;
  await createNotification({
    userId: options.assigneeId,
    houseId: options.houseId,
    taskId: options.taskId,
    type: "TASK_ASSIGNED",
    title: `Nouvelle tâche assignée: ${options.taskTitle}`,
    body: "Tu as une nouvelle tâche à prendre en charge.",
    linkUrl: `/app/tasks/${options.taskId}`,
    dedupeKey: `task-assigned:${options.taskId}:${options.assigneeId}`,
    sendEmail: true,
    bypassQuietHours: options.bypassQuietHours,
    bypassSchedule: options.bypassSchedule,
  });
}

export async function notifyTaskCommented(options: {
  houseId: string;
  taskId: string;
  taskTitle: string;
  recipientId: string;
  actorId: string;
  bypassQuietHours?: boolean;
  bypassSchedule?: boolean;
}) {
  if (options.recipientId === options.actorId) return;
  await createNotification({
    userId: options.recipientId,
    houseId: options.houseId,
    taskId: options.taskId,
    type: "TASK_COMMENTED",
    title: `Nouveau commentaire sur "${options.taskTitle}"`,
    body: "Un commentaire vient d'être ajouté.",
    linkUrl: `/app/tasks/${options.taskId}`,
    dedupeKey: `task-comment:${options.taskId}:${options.recipientId}:${Date.now()}`,
    sendEmail: true,
    bypassQuietHours: options.bypassQuietHours,
    bypassSchedule: options.bypassSchedule,
  });
}

export async function notifyTaskStatusChanged(options: {
  houseId: string;
  taskId: string;
  taskTitle: string;
  recipientId: string;
  actorId: string;
  status: "DONE" | "TODO" | "IN_PROGRESS";
  bypassQuietHours?: boolean;
  bypassSchedule?: boolean;
}) {
  if (options.recipientId === options.actorId) return;
  const statusLabel = options.status === "DONE" ? "terminée" : "mise à jour";
  await createNotification({
    userId: options.recipientId,
    houseId: options.houseId,
    taskId: options.taskId,
    type: "TASK_STATUS",
    title: `Tâche ${statusLabel}: ${options.taskTitle}`,
    body: `La tâche a été marquée comme ${statusLabel}.`,
    linkUrl: `/app/tasks/${options.taskId}`,
    dedupeKey: `task-status:${options.taskId}:${options.recipientId}:${options.status}`,
    sendEmail: true,
    bypassQuietHours: options.bypassQuietHours,
    bypassSchedule: options.bypassSchedule,
  });
}

export async function notifyProjectCreated(options: {
  houseId: string;
  projectId: string;
  projectName: string;
  actorId: string;
}) {
  const members = await prisma.houseMember.findMany({
    where: { houseId: options.houseId },
    select: { userId: true },
  });

  await Promise.all(
    members
      .map((member) => member.userId)
      .filter((userId) => userId !== options.actorId)
      .map((userId) =>
        createNotification({
          userId,
          houseId: options.houseId,
          type: "PROJECT_CREATED",
          title: `Nouveau projet: ${options.projectName}`,
          body: "Un nouveau projet a été ajouté à la maison.",
          linkUrl: `/app/projects`,
          dedupeKey: `project-created:${options.projectId}:${userId}`,
          sendEmail: true,
        })
      )
  );
}

export async function notifyInviteAccepted(options: {
  houseId: string;
  inviterId: string;
  inviteeName?: string | null;
}) {
  await createNotification({
    userId: options.inviterId,
    houseId: options.houseId,
    type: "INVITE_ACCEPTED",
    title: "Invitation acceptée",
    body: options.inviteeName
      ? `${options.inviteeName} a rejoint la maison.`
      : "Un membre a rejoint la maison.",
    linkUrl: "/app/settings",
    dedupeKey: `invite-accepted:${options.houseId}:${options.inviterId}:${options.inviteeName ?? "member"}`,
    sendEmail: true,
  });
}

export async function ensureTaskReminders(houseId: string) {
  const today = startOfDay(new Date());

  try {
    const tasks = await prisma.task.findMany({
      where: {
        houseId,
        isTemplate: false,
        status: { not: "DONE" },
        dueDate: { not: null },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        reminderOffsetDays: true,
        assigneeId: true,
        createdById: true,
        notificationBypassQuietHours: true,
        notificationBypassSchedule: true,
      },
    });

    await Promise.all(
      tasks.map(async (task) => {
        if (!task.dueDate) return;
        const reminderOffset = task.reminderOffsetDays ?? 0;
        const reminderDate = startOfDay(subDays(task.dueDate, reminderOffset));
        if (!isSameDay(reminderDate, today)) return;

        const recipientId = task.assigneeId ?? task.createdById;
        const dateLabel = format(task.dueDate, "dd/MM/yyyy");
        const dedupeKey = `task-reminder:${task.id}:${recipientId}:${format(
          reminderDate,
          "yyyy-MM-dd"
        )}`;

        await createNotification({
          userId: recipientId,
          houseId,
          taskId: task.id,
          type: "TASK_REMINDER",
          title: `Rappel: ${task.title}`,
          body: `Échéance prévue le ${dateLabel}.`,
          linkUrl: `/app/tasks/${task.id}`,
          dedupeKey,
          sendEmail: true,
          bypassQuietHours: task.notificationBypassQuietHours,
          bypassSchedule: task.notificationBypassSchedule,
        });
      })
    );
  } catch (error) {
    if (isNotificationUnavailableError(error)) {
      return;
    }
    throw error;
  }
}

export async function getUnreadNotificationCount(userId: string) {
  try {
    return await prisma.notification.count({
      where: { userId, readAt: null },
    });
  } catch (error) {
    if (isNotificationUnavailableError(error)) {
      return 0;
    }
    throw error;
  }
}

export async function ensureTaskEscalations(houseId: string) {
  try {
    const house = await prisma.house.findUnique({
      where: { id: houseId },
      select: { createdById: true },
    });

    if (!house) return;

    const tasks = await prisma.task.findMany({
      where: {
        houseId,
        isTemplate: false,
        status: { not: "DONE" },
        assigneeId: { not: null },
      },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        createdById: true,
        notificationEscalationEnabled: true,
        notificationEscalationDelayHours: true,
        notificationBypassQuietHours: true,
        notificationBypassSchedule: true,
      },
    });

    const settingsCache = new Map<string, NotificationSettings>();

    await Promise.all(
      tasks.map(async (task) => {
        if (!task.assigneeId) return;
        let settings = settingsCache.get(task.assigneeId);
        if (!settings) {
          settings = await getNotificationSettings(task.assigneeId);
          settingsCache.set(task.assigneeId, settings);
        }
        const escalationEnabled =
          task.notificationEscalationEnabled ?? settings.escalationEnabled;
        if (!escalationEnabled) return;

        const delayHours =
          task.notificationEscalationDelayHours ?? settings.escalationDelayHours;
        if (!Number.isFinite(delayHours) || delayHours <= 0) return;

        const lastNotification = await prisma.notification.findFirst({
          where: {
            taskId: task.id,
            userId: task.assigneeId,
            type: { in: ["TASK_ASSIGNED", "TASK_REMINDER", "TASK_STATUS"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, readAt: true, createdAt: true },
        });

        if (!lastNotification || lastNotification.readAt) return;

        const elapsedMs = Date.now() - lastNotification.createdAt.getTime();
        if (elapsedMs < delayHours * 60 * 60 * 1000) return;

        const recipients = new Set<string>([task.createdById, house.createdById]);
        recipients.delete(task.assigneeId);

        await Promise.all(
          Array.from(recipients).map((recipientId) =>
            createNotification({
              userId: recipientId,
              houseId,
              taskId: task.id,
              type: "TASK_ESCALATION",
              title: `Escalade: ${task.title}`,
              body: "La tâche n'a pas été confirmée par la personne assignée.",
              linkUrl: `/app/tasks/${task.id}`,
              dedupeKey: `task-escalation:${task.id}:${recipientId}:${lastNotification.id}`,
              sendEmail: true,
              bypassQuietHours: task.notificationBypassQuietHours,
              bypassSchedule: task.notificationBypassSchedule,
            })
          )
        );
      })
    );
  } catch (error) {
    if (isNotificationUnavailableError(error)) {
      return;
    }
    throw error;
  }
}
