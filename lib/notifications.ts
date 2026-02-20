import { Prisma } from "@prisma/client";
import { addHours, format, isSameDay, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { getAppBaseUrl, sendEmail } from "@/lib/email";

type NotificationOptions = {
  userId: string;
  houseId: string;
  type: "TASK_ASSIGNED" | "TASK_COMMENTED" | "TASK_STATUS" | "TASK_REMINDER" | "PROJECT_CREATED" | "INVITE_ACCEPTED";
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  dedupeKey?: string | null;
  sendEmail?: boolean;
  respectQuietHours?: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES = {
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  escalationEnabled: false,
  escalationDelayHours: 24,
  escalationTarget: "OWNER" as const,
};

function isNotificationUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function isNotificationPreferenceUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
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

function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function isWithinQuietHours(date: Date, start: string, end: string) {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return false;

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export async function getNotificationPreferences(userId: string, houseId: string) {
  try {
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId_houseId: { userId, houseId } },
      select: {
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        escalationEnabled: true,
        escalationDelayHours: true,
        escalationTarget: true,
      },
    });

    return preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  } catch (error) {
    if (isNotificationPreferenceUnavailableError(error)) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
    throw error;
  }
}

function resolveEscalationEnabled(
  taskOverride: "DEFAULT" | "ENABLED" | "DISABLED",
  preferenceEnabled: boolean
) {
  if (taskOverride === "ENABLED") return true;
  if (taskOverride === "DISABLED") return false;
  return preferenceEnabled;
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
    const preferences = await getNotificationPreferences(options.userId, options.houseId);
    const respectQuietHours = options.respectQuietHours ?? true;
    const isQuietHours =
      respectQuietHours &&
      preferences.quietHoursEnabled &&
      isWithinQuietHours(new Date(), preferences.quietHoursStart, preferences.quietHoursEnd);

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
        type: options.type,
        title: options.title,
        body: options.body,
        linkUrl: options.linkUrl,
        dedupeKey: options.dedupeKey ?? undefined,
      },
    });

    if (options.sendEmail && !isQuietHours) {
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
  respectQuietHours?: boolean;
}) {
  if (options.assigneeId === options.actorId) return;
  await createNotification({
    userId: options.assigneeId,
    houseId: options.houseId,
    type: "TASK_ASSIGNED",
    title: `Nouvelle tâche assignée: ${options.taskTitle}`,
    body: "Tu as une nouvelle tâche à prendre en charge.",
    linkUrl: `/app/tasks/${options.taskId}`,
    dedupeKey: `task-assigned:${options.taskId}:${options.assigneeId}`,
    sendEmail: true,
    respectQuietHours: options.respectQuietHours,
  });
}

export async function notifyTaskCommented(options: {
  houseId: string;
  taskId: string;
  taskTitle: string;
  recipientId: string;
  actorId: string;
}) {
  if (options.recipientId === options.actorId) return;
  await createNotification({
    userId: options.recipientId,
    houseId: options.houseId,
    type: "TASK_COMMENTED",
    title: `Nouveau commentaire sur "${options.taskTitle}"`,
    body: "Un commentaire vient d'être ajouté.",
    linkUrl: `/app/tasks/${options.taskId}`,
    dedupeKey: `task-comment:${options.taskId}:${options.recipientId}:${Date.now()}`,
    sendEmail: true,
  });
}

export async function notifyTaskStatusChanged(options: {
  houseId: string;
  taskId: string;
  taskTitle: string;
  recipientId: string;
  actorId: string;
  status: "DONE" | "TODO" | "IN_PROGRESS";
}) {
  if (options.recipientId === options.actorId) return;
  const statusLabel = options.status === "DONE" ? "terminée" : "mise à jour";
  await createNotification({
    userId: options.recipientId,
    houseId: options.houseId,
    type: "TASK_STATUS",
    title: `Tâche ${statusLabel}: ${options.taskTitle}`,
    body: `La tâche a été marquée comme ${statusLabel}.`,
    linkUrl: `/app/tasks/${options.taskId}`,
    dedupeKey: `task-status:${options.taskId}:${options.recipientId}:${options.status}`,
    sendEmail: true,
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
        ignoreQuietHours: true,
        assigneeId: true,
        createdById: true,
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
          type: "TASK_REMINDER",
          title: `Rappel: ${task.title}`,
          body: `Échéance prévue le ${dateLabel}.`,
          linkUrl: `/app/tasks/${task.id}`,
          dedupeKey,
          sendEmail: true,
          respectQuietHours: !task.ignoreQuietHours,
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

export async function ensureTaskEscalations(houseId: string) {
  try {
    const pendingAssignments = await prisma.notification.findMany({
      where: { houseId, type: "TASK_ASSIGNED", readAt: null },
      select: {
        id: true,
        userId: true,
        linkUrl: true,
        dedupeKey: true,
        createdAt: true,
      },
    });

    if (!pendingAssignments.length) return;

    const taskIds = pendingAssignments
      .map((notification) => {
        if (notification.dedupeKey?.startsWith("task-assigned:")) {
          const [, taskId] = notification.dedupeKey.split(":");
          if (taskId) return taskId;
        }
        const match = /\/app\/tasks\/([^/]+)$/.exec(notification.linkUrl ?? "");
        return match?.[1] ?? null;
      })
      .filter(Boolean) as string[];

    if (!taskIds.length) return;

    const [tasks, owners] = await Promise.all([
      prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: {
          id: true,
          title: true,
          houseId: true,
          status: true,
          createdById: true,
          assigneeId: true,
          ignoreQuietHours: true,
          escalationOverride: true,
          escalationDelayHours: true,
        },
      }),
      prisma.houseMember.findMany({
        where: { houseId, role: "OWNER" },
        select: { userId: true },
      }),
    ]);

    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const ownerIds = owners.map((owner) => owner.userId);
    const preferencesCache = new Map<string, Awaited<ReturnType<typeof getNotificationPreferences>>>();
    const now = new Date();

    for (const notification of pendingAssignments) {
      const taskId =
        notification.dedupeKey?.startsWith("task-assigned:")
          ? notification.dedupeKey.split(":")[1]
          : /\/app\/tasks\/([^/]+)$/.exec(notification.linkUrl ?? "")?.[1];
      if (!taskId) continue;
      const task = taskMap.get(taskId);
      if (!task || task.status === "DONE") continue;
      if (!task.assigneeId || task.assigneeId !== notification.userId) continue;

      const assigneeId = task.assigneeId;
      const preferences =
        preferencesCache.get(assigneeId) ??
        (await getNotificationPreferences(assigneeId, houseId));
      preferencesCache.set(assigneeId, preferences);

      const escalationEnabled = resolveEscalationEnabled(
        task.escalationOverride,
        preferences.escalationEnabled
      );
      if (!escalationEnabled) continue;

      const delayHours = task.escalationDelayHours ?? preferences.escalationDelayHours;
      if (!delayHours || delayHours <= 0) continue;
      const dueTime = addHours(notification.createdAt, delayHours);
      if (dueTime > now) continue;

      const recipientSet = new Set<string>();
      if (
        preferences.escalationTarget === "OWNER" ||
        preferences.escalationTarget === "OWNER_AND_CREATOR"
      ) {
        ownerIds.forEach((ownerId) => recipientSet.add(ownerId));
      }
      if (
        preferences.escalationTarget === "CREATOR" ||
        preferences.escalationTarget === "OWNER_AND_CREATOR"
      ) {
        if (task.createdById) recipientSet.add(task.createdById);
      }

      recipientSet.delete(assigneeId);

      if (!recipientSet.size) continue;

      await Promise.all(
        Array.from(recipientSet).map((recipientId) =>
          createNotification({
            userId: recipientId,
            houseId,
            type: "TASK_ASSIGNED",
            title: `Escalade: ${task.title}`,
            body: "La tâche n'a pas encore été prise en charge.",
            linkUrl: `/app/tasks/${task.id}`,
            dedupeKey: `task-escalation:${task.id}:${assigneeId}:${recipientId}`,
            sendEmail: true,
            respectQuietHours: !task.ignoreQuietHours,
          })
        )
      );
    }
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
