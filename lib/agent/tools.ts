import {
  BudgetEntrySource,
  BudgetEntryType,
  RecurrenceUnit,
  TaskStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBudgetRuntimeDelegates } from "@/lib/budget";
import { prisma } from "@/lib/db";
import { getNextImportantDateOccurrence } from "@/lib/important-dates";

export type AgentToolContext = {
  userId: string;
  houseId: string;
};

type OpenAIFunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type TaskRecord = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: Date | null;
};

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const monthRegex = /^\d{4}-\d{2}$/;

const createTaskArgsSchema = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.string().regex(dateRegex).optional(),
  reminderOffsetDays: z.number().int().min(0).max(365).optional(),
  assignee: z.string().trim().max(200).optional(),
  zone: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  project: z.string().trim().max(100).optional(),
  equipment: z.string().trim().max(100).optional(),
  animal: z.string().trim().max(100).optional(),
  person: z.string().trim().max(100).optional(),
  recurrenceUnit: z
    .enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
    .optional(),
  recurrenceInterval: z.number().int().min(1).max(365).optional(),
});

const listTasksArgsSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  dueFrom: z.string().regex(dateRegex).optional(),
  dueTo: z.string().regex(dateRegex).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const updateTaskStatusArgsSchema = z.object({
  taskId: z.string().cuid().optional(),
  taskTitle: z.string().trim().min(2).max(200).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
});

const deleteTaskArgsSchema = z.object({
  taskId: z.string().cuid().optional(),
  taskTitle: z.string().trim().min(2).max(200).optional(),
});

const createProjectArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional(),
  startsAt: z.string().regex(dateRegex).optional(),
  endsAt: z.string().regex(dateRegex).optional(),
});

const createEquipmentArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  location: z.string().trim().max(200).optional(),
  category: z.string().trim().max(200).optional(),
  purchasedAt: z.string().regex(dateRegex).optional(),
  installedAt: z.string().regex(dateRegex).optional(),
  lifespanMonths: z.number().int().min(1).max(1200).optional(),
});

const createShoppingListArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

const addShoppingItemArgsSchema = z.object({
  shoppingListId: z.string().cuid().optional(),
  shoppingListName: z.string().trim().min(1).max(200).optional(),
  itemName: z.string().trim().min(1).max(200),
});

const simpleNameSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

const createAnimalArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  species: z.string().trim().max(100).optional(),
});

const createPersonArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  relation: z.string().trim().max(100).optional(),
});

const todayTasksArgsSchema = z.object({
  includeDone: z.boolean().optional(),
});

const dayTasksArgsSchema = z.object({
  date: z.string().regex(dateRegex),
  includeDone: z.boolean().optional(),
});

const createBudgetEntryArgsSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  label: z.string().trim().min(1).max(200),
  amount: z.number().nonnegative().max(1_000_000),
  occurredOn: z.string().regex(dateRegex).optional(),
  isForecast: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const createBudgetRecurringEntryArgsSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  label: z.string().trim().min(1).max(200),
  amount: z.number().nonnegative().max(1_000_000),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  startMonth: z.string().regex(monthRegex).optional(),
  endMonth: z.string().regex(monthRegex).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const listMonthlyBudgetArgsSchema = z.object({
  month: z.string().regex(monthRegex).optional(),
});

function asToolResult(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}

function parseDateAtNoon(value?: string | null) {
  if (!value) return null;
  if (!dateRegex.test(value)) {
    throw new Error("Format de date attendu: YYYY-MM-DD");
  }
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Date invalide: ${value}`);
  }
  return date;
}

function buildDayRange(value: string) {
  if (!dateRegex.test(value)) {
    throw new Error("Format de date attendu: YYYY-MM-DD");
  }
  const [year, month, day] = value.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start, end };
}

function parseMonthRange(value?: string) {
  const now = new Date();
  const monthValue = value && monthRegex.test(value)
    ? value
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { monthValue, start, end };
}

function recurringDateForMonth(month: string, dayOfMonth: number | null) {
  const [year, monthNumber] = month.split("-").map(Number);
  const maxDay = new Date(year, monthNumber, 0).getDate();
  const day = Math.max(1, Math.min(dayOfMonth ?? 1, maxDay));
  return new Date(year, monthNumber - 1, day, 12, 0, 0, 0);
}

function formatEuroFromAmount(amountCents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function ensureBudgetFeatureAvailable() {
  if (!getBudgetRuntimeDelegates()) {
    throw new Error(
      "Le module budget n'est pas disponible pour l'agent. Exécute `npm run db:push` puis redémarre le serveur."
    );
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function formatDate(date: Date | null) {
  if (!date) return "sans date";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

function revalidateAppPaths() {
  revalidatePath("/");
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  revalidatePath("/app/calendar");
  revalidatePath("/app/budgets");
  revalidatePath("/app/shopping-lists");
  revalidatePath("/app/projects");
  revalidatePath("/app/equipment");
  revalidatePath("/app/settings");
}

async function resolveRelationIdByName(
  model: "zone" | "category" | "project" | "equipment" | "animal" | "person",
  houseId: string,
  value?: string
) {
  if (!value) return null;
  const name = value.trim();
  if (!name) return null;

  if (model === "zone") {
    const zone = await prisma.zone.findFirst({
      where: { houseId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    return zone?.id ?? null;
  }

  if (model === "category") {
    const category = await prisma.category.findFirst({
      where: { houseId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  if (model === "project") {
    const project = await prisma.project.findFirst({
      where: { houseId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    return project?.id ?? null;
  }

  if (model === "equipment") {
    const equipment = await prisma.equipment.findFirst({
      where: { houseId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    return equipment?.id ?? null;
  }

  if (model === "animal") {
    const animal = await prisma.animal.findFirst({
      where: { houseId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    return animal?.id ?? null;
  }

  const person = await prisma.person.findFirst({
    where: { houseId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return person?.id ?? null;
}

async function resolveAssigneeId(houseId: string, rawAssignee?: string) {
  if (!rawAssignee) return null;
  const assignee = rawAssignee.trim();
  if (!assignee) return null;

  const members = await prisma.houseMember.findMany({
    where: { houseId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const normalized = normalize(assignee);
  const exact = members.find((member) => {
    const name = member.user.name ? normalize(member.user.name) : "";
    const email = member.user.email ? normalize(member.user.email) : "";
    return name === normalized || email === normalized;
  });

  if (exact) return exact.userId;

  const fuzzy = members.find((member) => {
    const name = member.user.name ? normalize(member.user.name) : "";
    const email = member.user.email ? normalize(member.user.email) : "";
    return name.includes(normalized) || email.includes(normalized);
  });

  return fuzzy?.userId ?? null;
}

async function findTaskByIdOrTitle(
  houseId: string,
  taskId?: string,
  taskTitle?: string
): Promise<TaskRecord | null> {
  if (taskId) {
    const byId = await prisma.task.findFirst({
      where: {
        id: taskId,
        houseId,
        isTemplate: false,
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
      },
    });
    return byId;
  }

  if (!taskTitle) {
    return null;
  }

  const normalized = taskTitle.trim();
  if (!normalized) return null;

  const exact = await prisma.task.findFirst({
    where: {
      houseId,
      isTemplate: false,
      title: { equals: normalized, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
    },
  });

  if (exact) return exact;

  const contains = await prisma.task.findFirst({
    where: {
      houseId,
      isTemplate: false,
      title: { contains: normalized, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
    },
  });

  return contains;
}

async function toolGetContext({ houseId }: AgentToolContext) {
  const budgetEnabled = Boolean(getBudgetRuntimeDelegates());
  const [members, zones, categories, projects, equipments, shoppingLists, importantDates] =
    await Promise.all([
      prisma.houseMember.findMany({
        where: { houseId },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.zone.findMany({ where: { houseId }, orderBy: { name: "asc" } }),
      prisma.category.findMany({
        where: { houseId },
        orderBy: { name: "asc" },
      }),
      prisma.project.findMany({
        where: { houseId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.equipment.findMany({
        where: { houseId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.shoppingList.findMany({
        where: { houseId },
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.importantDate.findMany({
        where: { houseId },
        orderBy: [{ date: "asc" }, { title: "asc" }],
      }),
    ]);

  const upcomingImportantDates = importantDates
    .map((item) => ({
      ...item,
      nextOccurrence: getNextImportantDateOccurrence(item.date, item.isRecurringYearly),
    }))
    .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime())
    .slice(0, 20);

  return asToolResult({
    ok: true,
    data: {
      members: members.map((member) => member.user.name || member.user.email),
      zones: zones.map((zone) => zone.name),
      categories: categories.map((category) => category.name),
      projects: projects.map((project) => project.name),
      equipments: equipments.map((equipment) => equipment.name),
      shoppingLists: shoppingLists.map((list) => ({
        id: list.id,
        name: list.name,
        itemsCount: list._count.items,
      })),
      importantDates: upcomingImportantDates.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        nextOccurrence: formatDate(item.nextOccurrence),
        recurring: item.isRecurringYearly,
      })),
      budgetEnabled,
    },
  });
}

async function toolGetTodayTasks(
  args: unknown,
  { houseId }: AgentToolContext
) {
  const parsed = todayTasksArgsSchema.parse(args ?? {});
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );

  const tasks = await prisma.task.findMany({
    where: {
      houseId,
      isTemplate: false,
      dueDate: {
        gte: todayStart,
        lt: todayEnd,
      },
      ...(parsed.includeDone ? {} : { status: { not: "DONE" } }),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      assignee: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return asToolResult({
    ok: true,
    total: tasks.length,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: formatDate(task.dueDate),
      assignee: task.assignee?.name || task.assignee?.email || null,
    })),
  });
}

async function toolGetTasksForDay(args: unknown, { houseId }: AgentToolContext) {
  const parsed = dayTasksArgsSchema.parse(args ?? {});
  const range = buildDayRange(parsed.date);

  const tasks = await prisma.task.findMany({
    where: {
      houseId,
      isTemplate: false,
      dueDate: {
        gte: range.start,
        lt: range.end,
      },
      ...(parsed.includeDone ? {} : { status: { not: "DONE" } }),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      assignee: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return asToolResult({
    ok: true,
    total: tasks.length,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: formatDate(task.dueDate),
      assignee: task.assignee?.name || task.assignee?.email || null,
    })),
  });
}

async function toolListTasks(args: unknown, { houseId }: AgentToolContext) {
  const parsed = listTasksArgsSchema.parse(args ?? {});
  const dueFrom = parseDateAtNoon(parsed.dueFrom);
  const dueTo = parseDateAtNoon(parsed.dueTo);

  const tasks = await prisma.task.findMany({
    where: {
      houseId,
      isTemplate: false,
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(dueFrom || dueTo
        ? {
            dueDate: {
              ...(dueFrom ? { gte: dueFrom } : {}),
              ...(dueTo ? { lte: dueTo } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: parsed.limit ?? 20,
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      zone: { select: { name: true } },
      category: { select: { name: true } },
      assignee: { select: { name: true, email: true } },
    },
  });

  return asToolResult({
    ok: true,
    total: tasks.length,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: formatDate(task.dueDate),
      zone: task.zone?.name ?? null,
      category: task.category?.name ?? null,
      assignee: task.assignee?.name || task.assignee?.email || null,
    })),
  });
}

async function toolCreateTask(args: unknown, { userId, houseId }: AgentToolContext) {
  const parsed = createTaskArgsSchema.parse(args ?? {});

  const [zoneId, categoryId, projectId, equipmentId, animalId, personId, assigneeId] =
    await Promise.all([
      resolveRelationIdByName("zone", houseId, parsed.zone),
      resolveRelationIdByName("category", houseId, parsed.category),
      resolveRelationIdByName("project", houseId, parsed.project),
      resolveRelationIdByName("equipment", houseId, parsed.equipment),
      resolveRelationIdByName("animal", houseId, parsed.animal),
      resolveRelationIdByName("person", houseId, parsed.person),
      resolveAssigneeId(houseId, parsed.assignee),
    ]);

  const dueDate = parseDateAtNoon(parsed.dueDate);

  if (parsed.recurrenceUnit) {
    const normalizedDueDate = dueDate ?? new Date();
    normalizedDueDate.setHours(12, 0, 0, 0);

    const template = await prisma.task.create({
      data: {
        houseId,
        title: parsed.title,
        description: parsed.description ?? null,
        dueDate: normalizedDueDate,
        isTemplate: true,
        recurrenceUnit: parsed.recurrenceUnit as RecurrenceUnit,
        recurrenceInterval: parsed.recurrenceInterval ?? 1,
        reminderOffsetDays: parsed.reminderOffsetDays ?? null,
        createdById: userId,
        assigneeId,
        zoneId,
        categoryId,
        projectId,
        equipmentId,
        animalId,
        personId,
      },
      select: { id: true },
    });

    const instance = await prisma.task.create({
      data: {
        houseId,
        title: parsed.title,
        description: parsed.description ?? null,
        dueDate: normalizedDueDate,
        reminderOffsetDays: parsed.reminderOffsetDays ?? null,
        createdById: userId,
        assigneeId,
        zoneId,
        categoryId,
        projectId,
        equipmentId,
        animalId,
        personId,
        parentId: template.id,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
      },
    });

    revalidateAppPaths();

    return asToolResult({
      ok: true,
      message: "Tâche récurrente créée",
      task: {
        id: instance.id,
        title: instance.title,
        dueDate: formatDate(instance.dueDate),
      },
      recurrence: {
        unit: parsed.recurrenceUnit,
        interval: parsed.recurrenceInterval ?? 1,
      },
    });
  }

  const created = await prisma.task.create({
    data: {
      houseId,
      title: parsed.title,
      description: parsed.description ?? null,
      dueDate,
      reminderOffsetDays: parsed.reminderOffsetDays ?? null,
      createdById: userId,
      assigneeId,
      zoneId,
      categoryId,
      projectId,
      equipmentId,
      animalId,
      personId,
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Tâche créée",
    task: {
      id: created.id,
      title: created.title,
      dueDate: formatDate(created.dueDate),
      status: created.status,
    },
  });
}

async function toolUpdateTaskStatus(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updateTaskStatusArgsSchema.parse(args ?? {});
  const task = await findTaskByIdOrTitle(houseId, parsed.taskId, parsed.taskTitle);

  if (!task) {
    throw new Error("Tâche introuvable. Donnez un id ou un titre plus précis.");
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { status: parsed.status as TaskStatus },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Statut de tâche mis à jour",
    task: {
      id: task.id,
      title: task.title,
      status: parsed.status,
    },
  });
}

async function toolDeleteTask(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deleteTaskArgsSchema.parse(args ?? {});
  const task = await findTaskByIdOrTitle(houseId, parsed.taskId, parsed.taskTitle);

  if (!task) {
    throw new Error("Tâche introuvable. Donnez un id ou un titre plus précis.");
  }

  await prisma.task.delete({ where: { id: task.id } });
  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Tâche supprimée",
    task: {
      id: task.id,
      title: task.title,
    },
  });
}

async function toolCreateProject(args: unknown, { houseId }: AgentToolContext) {
  const parsed = createProjectArgsSchema.parse(args ?? {});

  const created = await prisma.project.create({
    data: {
      houseId,
      name: parsed.name,
      description: parsed.description ?? null,
      startsAt: parseDateAtNoon(parsed.startsAt),
      endsAt: parseDateAtNoon(parsed.endsAt),
    },
    select: {
      id: true,
      name: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Projet créé",
    project: created,
  });
}

async function toolCreateEquipment(args: unknown, { houseId }: AgentToolContext) {
  const parsed = createEquipmentArgsSchema.parse(args ?? {});

  const created = await prisma.equipment.create({
    data: {
      houseId,
      name: parsed.name,
      location: parsed.location ?? null,
      category: parsed.category ?? null,
      purchasedAt: parseDateAtNoon(parsed.purchasedAt),
      installedAt: parseDateAtNoon(parsed.installedAt),
      lifespanMonths: parsed.lifespanMonths ?? null,
    },
    select: {
      id: true,
      name: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Équipement créé",
    equipment: created,
  });
}

async function toolCreateShoppingList(args: unknown, { houseId }: AgentToolContext) {
  const parsed = createShoppingListArgsSchema.parse(args ?? {});

  const created = await prisma.shoppingList.create({
    data: {
      houseId,
      name: parsed.name,
    },
    select: {
      id: true,
      name: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Liste d'achats créée",
    shoppingList: created,
  });
}

async function toolAddShoppingItem(args: unknown, { houseId }: AgentToolContext) {
  const parsed = addShoppingItemArgsSchema.parse(args ?? {});

  const shoppingList = parsed.shoppingListId
    ? await prisma.shoppingList.findFirst({
        where: {
          id: parsed.shoppingListId,
          houseId,
        },
        select: {
          id: true,
          name: true,
        },
      })
    : await prisma.shoppingList.findFirst({
        where: {
          houseId,
          name: {
            equals: parsed.shoppingListName?.trim() ?? "",
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

  if (!shoppingList) {
    throw new Error(
      "Liste d'achats introuvable. Donnez shoppingListId ou shoppingListName exact."
    );
  }

  const created = await prisma.shoppingListItem.create({
    data: {
      shoppingListId: shoppingList.id,
      name: parsed.itemName,
    },
    select: {
      id: true,
      name: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Article ajouté",
    shoppingList: {
      id: shoppingList.id,
      name: shoppingList.name,
    },
    item: created,
  });
}

async function toolCreateBudgetEntry(
  args: unknown,
  { userId, houseId }: AgentToolContext
) {
  ensureBudgetFeatureAvailable();
  const parsed = createBudgetEntryArgsSchema.parse(args ?? {});
  const occurredOn = parseDateAtNoon(parsed.occurredOn) ?? new Date();
  occurredOn.setHours(12, 0, 0, 0);
  const amountCents = Math.round(parsed.amount * 100);

  const created = await prisma.budgetEntry.create({
    data: {
      houseId,
      createdById: userId,
      type: parsed.type as BudgetEntryType,
      source: BudgetEntrySource.MANUAL,
      label: parsed.label,
      amountCents,
      occurredOn,
      isForecast: parsed.isForecast ?? false,
      notes: parsed.notes ?? null,
    },
    select: {
      id: true,
      type: true,
      label: true,
      amountCents: true,
      occurredOn: true,
      isForecast: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: created.type === "INCOME" ? "Revenu ajouté" : "Dépense ajoutée",
    budgetEntry: {
      id: created.id,
      type: created.type,
      label: created.label,
      amount: formatEuroFromAmount(created.amountCents),
      occurredOn: formatDate(created.occurredOn),
      isForecast: created.isForecast,
    },
  });
}

async function toolCreateBudgetRecurringEntry(
  args: unknown,
  { userId, houseId }: AgentToolContext
) {
  ensureBudgetFeatureAvailable();
  const parsed = createBudgetRecurringEntryArgsSchema.parse(args ?? {});
  const amountCents = Math.round(parsed.amount * 100);
  const startMonth = parsed.startMonth
    ? parseMonthRange(parsed.startMonth).start
    : parseMonthRange().start;
  const endMonth = parsed.endMonth ? parseMonthRange(parsed.endMonth).start : null;

  if (endMonth && endMonth.getTime() < startMonth.getTime()) {
    throw new Error("Le mois de fin doit être postérieur ou égal au mois de début.");
  }

  const created = await prisma.budgetRecurringEntry.create({
    data: {
      houseId,
      createdById: userId,
      type: parsed.type as BudgetEntryType,
      label: parsed.label,
      amountCents,
      dayOfMonth: parsed.dayOfMonth ?? null,
      startMonth,
      endMonth,
      notes: parsed.notes ?? null,
    },
    select: {
      id: true,
      type: true,
      label: true,
      amountCents: true,
      dayOfMonth: true,
      startMonth: true,
      endMonth: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message:
      created.type === "INCOME"
        ? "Revenu récurrent ajouté"
        : "Dépense récurrente ajoutée",
    recurringEntry: {
      id: created.id,
      type: created.type,
      label: created.label,
      amount: formatEuroFromAmount(created.amountCents),
      dayOfMonth: created.dayOfMonth,
      startMonth: `${created.startMonth.getFullYear()}-${String(
        created.startMonth.getMonth() + 1
      ).padStart(2, "0")}`,
      endMonth: created.endMonth
        ? `${created.endMonth.getFullYear()}-${String(
            created.endMonth.getMonth() + 1
          ).padStart(2, "0")}`
        : null,
    },
  });
}

async function toolListMonthlyBudget(args: unknown, { houseId }: AgentToolContext) {
  ensureBudgetFeatureAvailable();
  const parsed = listMonthlyBudgetArgsSchema.parse(args ?? {});
  const { monthValue, start, end } = parseMonthRange(parsed.month);
  const monthEndInclusive = new Date(end.getTime() - 1);

  const [entries, recurringEntries] = await Promise.all([
    prisma.budgetEntry.findMany({
      where: {
        houseId,
        occurredOn: { gte: start, lt: end },
      },
      orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        type: true,
        source: true,
        label: true,
        amountCents: true,
        occurredOn: true,
        isForecast: true,
        recurringEntryId: true,
      },
    }),
    prisma.budgetRecurringEntry.findMany({
      where: {
        houseId,
        startMonth: { lte: monthEndInclusive },
        OR: [{ endMonth: null }, { endMonth: { gte: start } }],
      },
      orderBy: [{ type: "asc" }, { label: "asc" }],
      select: {
        id: true,
        type: true,
        label: true,
        amountCents: true,
        dayOfMonth: true,
      },
    }),
  ]);

  const materializedRecurringIds = new Set(
    entries
      .filter((entry) => entry.recurringEntryId !== null)
      .map((entry) => entry.recurringEntryId!)
  );

  const recurringProjected = recurringEntries
    .filter((entry) => !materializedRecurringIds.has(entry.id))
    .map((entry) => ({
      id: `projected-${entry.id}-${monthValue}`,
      type: entry.type,
      source: "RECURRING",
      label: entry.label,
      amountCents: entry.amountCents,
      occurredOn: recurringDateForMonth(monthValue, entry.dayOfMonth),
      isForecast: true,
      projected: true,
    }));

  const allEntries = [
    ...entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      source: entry.source,
      label: entry.label,
      amountCents: entry.amountCents,
      occurredOn: entry.occurredOn,
      isForecast: entry.isForecast,
      projected: false,
    })),
    ...recurringProjected,
  ].sort((a, b) => a.occurredOn.getTime() - b.occurredOn.getTime());

  const incomeCents = allEntries
    .filter((entry) => entry.type === "INCOME")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const expenseCents = allEntries
    .filter((entry) => entry.type === "EXPENSE")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const balanceCents = incomeCents - expenseCents;

  return asToolResult({
    ok: true,
    month: monthValue,
    summary: {
      income: formatEuroFromAmount(incomeCents),
      expense: formatEuroFromAmount(expenseCents),
      balance: formatEuroFromAmount(balanceCents),
    },
    entries: allEntries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      source: entry.source,
      label: entry.label,
      amount: formatEuroFromAmount(entry.amountCents),
      occurredOn: formatDate(entry.occurredOn),
      isForecast: entry.isForecast,
      projected: entry.projected,
    })),
  });
}

async function toolCreateZone(args: unknown, { houseId }: AgentToolContext) {
  const parsed = simpleNameSchema.parse(args ?? {});
  const created = await prisma.zone.create({
    data: {
      houseId,
      name: parsed.name,
    },
    select: {
      id: true,
      name: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Zone créée",
    zone: created,
  });
}

async function toolCreateCategory(args: unknown, { houseId }: AgentToolContext) {
  const parsed = simpleNameSchema.parse(args ?? {});
  const created = await prisma.category.create({
    data: {
      houseId,
      name: parsed.name,
    },
    select: {
      id: true,
      name: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Catégorie créée",
    category: created,
  });
}

async function toolCreateAnimal(args: unknown, { houseId }: AgentToolContext) {
  const parsed = createAnimalArgsSchema.parse(args ?? {});
  const created = await prisma.animal.create({
    data: {
      houseId,
      name: parsed.name,
      species: parsed.species ?? null,
    },
    select: {
      id: true,
      name: true,
      species: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Animal créé",
    animal: created,
  });
}

async function toolCreatePerson(args: unknown, { houseId }: AgentToolContext) {
  const parsed = createPersonArgsSchema.parse(args ?? {});
  const created = await prisma.person.create({
    data: {
      houseId,
      name: parsed.name,
      relation: parsed.relation ?? null,
    },
    select: {
      id: true,
      name: true,
      relation: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Personne créée",
    person: created,
  });
}

export const agentFunctionTools: OpenAIFunctionTool[] = [
  {
    type: "function",
    name: "get_house_context",
    description:
      "Récupère les informations contextuelles de la maison (membres, zones, catégories, projets, équipements, listes d'achats).",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_today_tasks",
    description: "Liste les tâches du jour.",
    parameters: {
      type: "object",
      properties: {
        includeDone: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_tasks_for_day",
    description: "Liste les tâches pour une date précise (YYYY-MM-DD).",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date YYYY-MM-DD" },
        includeDone: { type: "boolean" },
      },
      required: ["date"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_tasks",
    description: "Liste les tâches avec filtres optionnels.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
        },
        dueFrom: { type: "string", description: "Date YYYY-MM-DD" },
        dueTo: { type: "string", description: "Date YYYY-MM-DD" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_task",
    description: "Crée une tâche et l'assigne éventuellement.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        dueDate: { type: "string", description: "Date YYYY-MM-DD" },
        reminderOffsetDays: { type: "integer", minimum: 0, maximum: 365 },
        assignee: { type: "string", description: "Nom ou email d'un membre" },
        zone: { type: "string" },
        category: { type: "string" },
        project: { type: "string" },
        equipment: { type: "string" },
        animal: { type: "string" },
        person: { type: "string" },
        recurrenceUnit: {
          type: "string",
          enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
        },
        recurrenceInterval: { type: "integer", minimum: 1, maximum: 365 },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_task_status",
    description: "Met à jour le statut d'une tâche.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        taskTitle: { type: "string" },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
        },
      },
      required: ["status"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_task",
    description: "Supprime une tâche via son id ou son titre.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        taskTitle: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_project",
    description: "Crée un projet.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        startsAt: { type: "string", description: "Date YYYY-MM-DD" },
        endsAt: { type: "string", description: "Date YYYY-MM-DD" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_equipment",
    description: "Crée un équipement.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        location: { type: "string" },
        category: { type: "string" },
        purchasedAt: { type: "string", description: "Date YYYY-MM-DD" },
        installedAt: { type: "string", description: "Date YYYY-MM-DD" },
        lifespanMonths: { type: "integer", minimum: 1, maximum: 1200 },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_shopping_list",
    description: "Crée une liste d'achats.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "add_shopping_item",
    description: "Ajoute un article dans une liste d'achats.",
    parameters: {
      type: "object",
      properties: {
        shoppingListId: { type: "string" },
        shoppingListName: { type: "string" },
        itemName: { type: "string" },
      },
      required: ["itemName"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_budget_entry",
    description:
      "Ajoute une dépense ou un revenu ponctuel dans le budget mensuel.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["INCOME", "EXPENSE"] },
        label: { type: "string" },
        amount: {
          type: "number",
          description: "Montant en euros, par ex: 125.5",
        },
        occurredOn: { type: "string", description: "Date YYYY-MM-DD" },
        isForecast: { type: "boolean" },
        notes: { type: "string" },
      },
      required: ["type", "label", "amount"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_budget_recurring_entry",
    description:
      "Ajoute une règle de dépense/revenu récurrent mensuel dans le budget.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["INCOME", "EXPENSE"] },
        label: { type: "string" },
        amount: {
          type: "number",
          description: "Montant en euros, par ex: 82.3",
        },
        dayOfMonth: { type: "integer", minimum: 1, maximum: 31 },
        startMonth: { type: "string", description: "Mois YYYY-MM" },
        endMonth: { type: "string", description: "Mois YYYY-MM" },
        notes: { type: "string" },
      },
      required: ["type", "label", "amount"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_monthly_budget",
    description:
      "Récupère le résumé budget d'un mois (revenus, dépenses, solde) et les lignes.",
    parameters: {
      type: "object",
      properties: {
        month: { type: "string", description: "Mois YYYY-MM" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_zone",
    description: "Crée une zone.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_category",
    description: "Crée une catégorie.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_animal",
    description: "Crée un animal.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        species: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_person",
    description: "Crée une personne.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        relation: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
];

export async function executeAgentTool(
  toolName: string,
  args: unknown,
  context: AgentToolContext
) {
  try {
    if (toolName === "get_house_context") {
      return await toolGetContext(context);
    }
    if (toolName === "get_today_tasks") {
      return await toolGetTodayTasks(args, context);
    }
    if (toolName === "get_tasks_for_day") {
      return await toolGetTasksForDay(args, context);
    }
    if (toolName === "list_tasks") {
      return await toolListTasks(args, context);
    }
    if (toolName === "create_task") {
      return await toolCreateTask(args, context);
    }
    if (toolName === "update_task_status") {
      return await toolUpdateTaskStatus(args, context);
    }
    if (toolName === "delete_task") {
      return await toolDeleteTask(args, context);
    }
    if (toolName === "create_project") {
      return await toolCreateProject(args, context);
    }
    if (toolName === "create_equipment") {
      return await toolCreateEquipment(args, context);
    }
    if (toolName === "create_shopping_list") {
      return await toolCreateShoppingList(args, context);
    }
    if (toolName === "add_shopping_item") {
      return await toolAddShoppingItem(args, context);
    }
    if (toolName === "create_budget_entry") {
      return await toolCreateBudgetEntry(args, context);
    }
    if (toolName === "create_budget_recurring_entry") {
      return await toolCreateBudgetRecurringEntry(args, context);
    }
    if (toolName === "list_monthly_budget") {
      return await toolListMonthlyBudget(args, context);
    }
    if (toolName === "create_zone") {
      return await toolCreateZone(args, context);
    }
    if (toolName === "create_category") {
      return await toolCreateCategory(args, context);
    }
    if (toolName === "create_animal") {
      return await toolCreateAnimal(args, context);
    }
    if (toolName === "create_person") {
      return await toolCreatePerson(args, context);
    }

    return asToolResult({
      ok: false,
      error: `Tool non pris en charge: ${toolName}`,
    });
  } catch (error) {
    return asToolResult({
      ok: false,
      error:
        error instanceof Error ? error.message : "Erreur inconnue pendant l'exécution du tool",
    });
  }
}
