import {
  BudgetEntrySource,
  BudgetEntryType,
  ImportantDateType,
  RecurrenceUnit,
  TaskStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBudgetRuntimeDelegates } from "@/lib/budget";
import { prisma } from "@/lib/db";
import {
  clearEquipmentImageGenerating,
  removeStoredEquipmentImageVariants,
} from "@/lib/equipment-images";
import { getNextImportantDateOccurrence } from "@/lib/important-dates";
import {
  enqueueEquipmentIllustration,
  enqueueProjectIllustration,
  enqueueTaskIllustration,
} from "@/lib/illustrations";
import {
  clearProjectImageGenerating,
  removeStoredProjectImageVariants,
} from "@/lib/project-images";
import { clearTaskImageGenerating } from "@/lib/task-images";

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

type BudgetRecurringEntryRecord = {
  id: string;
  type: BudgetEntryType;
  label: string;
  amountCents: number;
  dayOfMonth: number | null;
  startMonth: Date;
  endMonth: Date | null;
  notes: string | null;
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

const updateTaskArgsSchema = z
  .object({
    taskId: z.string().cuid().optional(),
    taskTitle: z.string().trim().min(2).max(200).optional(),
    title: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    dueDate: z.string().regex(dateRegex).nullable().optional(),
    reminderOffsetDays: z.number().int().min(0).max(365).nullable().optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
    assignee: z.string().trim().max(200).nullable().optional(),
    zone: z.string().trim().max(100).nullable().optional(),
    category: z.string().trim().max(100).nullable().optional(),
    project: z.string().trim().max(100).nullable().optional(),
    equipment: z.string().trim().max(100).nullable().optional(),
    animal: z.string().trim().max(100).nullable().optional(),
    person: z.string().trim().max(100).nullable().optional(),
  })
  .refine((value) => Boolean(value.taskId || value.taskTitle), {
    message: "Donnez taskId ou taskTitle.",
    path: ["taskId"],
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.dueDate !== undefined ||
      value.reminderOffsetDays !== undefined ||
      value.status !== undefined ||
      value.assignee !== undefined ||
      value.zone !== undefined ||
      value.category !== undefined ||
      value.project !== undefined ||
      value.equipment !== undefined ||
      value.animal !== undefined ||
      value.person !== undefined,
    {
      message:
        "Aucun champ à modifier. Fournis au moins un champ de tâche à mettre à jour.",
      path: ["title"],
    }
  );

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

const updateProjectArgsSchema = z
  .object({
    projectId: z.string().cuid().optional(),
    projectName: z.string().trim().min(2).max(200).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startsAt: z.string().regex(dateRegex).nullable().optional(),
    endsAt: z.string().regex(dateRegex).nullable().optional(),
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Donnez projectId ou projectName.",
    path: ["projectId"],
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.startsAt !== undefined ||
      value.endsAt !== undefined,
    {
      message:
        "Aucun champ à modifier. Fournis au moins un champ: name, description, startsAt ou endsAt.",
      path: ["name"],
    }
  );

const deleteProjectArgsSchema = z
  .object({
    projectId: z.string().cuid().optional(),
    projectName: z.string().trim().min(2).max(200).optional(),
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Donnez projectId ou projectName.",
    path: ["projectId"],
  });

const createEquipmentArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  location: z.string().trim().max(200).optional(),
  category: z.string().trim().max(200).optional(),
  purchasedAt: z.string().regex(dateRegex).optional(),
  installedAt: z.string().regex(dateRegex).optional(),
  lifespanMonths: z.number().int().min(1).max(1200).optional(),
});

const updateEquipmentArgsSchema = z
  .object({
    equipmentId: z.string().cuid().optional(),
    equipmentName: z.string().trim().min(2).max(200).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    location: z.string().trim().max(200).nullable().optional(),
    category: z.string().trim().max(200).nullable().optional(),
    purchasedAt: z.string().regex(dateRegex).nullable().optional(),
    installedAt: z.string().regex(dateRegex).nullable().optional(),
    lifespanMonths: z.number().int().min(1).max(1200).nullable().optional(),
  })
  .refine((value) => Boolean(value.equipmentId || value.equipmentName), {
    message: "Donnez equipmentId ou equipmentName.",
    path: ["equipmentId"],
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.location !== undefined ||
      value.category !== undefined ||
      value.purchasedAt !== undefined ||
      value.installedAt !== undefined ||
      value.lifespanMonths !== undefined,
    {
      message:
        "Aucun champ à modifier. Fournis au moins un champ d'équipement.",
      path: ["name"],
    }
  );

const deleteEquipmentArgsSchema = z
  .object({
    equipmentId: z.string().cuid().optional(),
    equipmentName: z.string().trim().min(2).max(200).optional(),
  })
  .refine((value) => Boolean(value.equipmentId || value.equipmentName), {
    message: "Donnez equipmentId ou equipmentName.",
    path: ["equipmentId"],
  });

const createShoppingListArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

const addShoppingItemArgsSchema = z.object({
  shoppingListId: z.string().cuid().optional(),
  shoppingListName: z.string().trim().min(1).max(200).optional(),
  itemName: z.string().trim().min(1).max(200),
});

const deleteShoppingListArgsSchema = z
  .object({
    shoppingListId: z.string().cuid().optional(),
    shoppingListName: z.string().trim().min(1).max(200).optional(),
  })
  .refine((value) => Boolean(value.shoppingListId || value.shoppingListName), {
    message: "Donnez shoppingListId ou shoppingListName.",
    path: ["shoppingListId"],
  });

const clearShoppingListArgsSchema = deleteShoppingListArgsSchema;

const toggleShoppingItemArgsSchema = z
  .object({
    itemId: z.string().cuid().optional(),
    itemName: z.string().trim().min(1).max(200).optional(),
    shoppingListId: z.string().cuid().optional(),
    shoppingListName: z.string().trim().min(1).max(200).optional(),
    completed: z.boolean(),
  })
  .refine((value) => Boolean(value.itemId || value.itemName), {
    message: "Donnez itemId ou itemName.",
    path: ["itemId"],
  });

const simpleNameSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

const updateNamedEntityArgsSchema = z
  .object({
    id: z.string().cuid().optional(),
    currentName: z.string().trim().min(2).max(200).optional(),
    name: z.string().trim().min(2).max(100),
  })
  .refine((value) => Boolean(value.id || value.currentName), {
    message: "Donnez id ou currentName.",
    path: ["id"],
  });

const deleteNamedEntityArgsSchema = z
  .object({
    id: z.string().cuid().optional(),
    name: z.string().trim().min(2).max(200).optional(),
  })
  .refine((value) => Boolean(value.id || value.name), {
    message: "Donnez id ou name.",
    path: ["id"],
  });

const createAnimalArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  species: z.string().trim().max(100).optional(),
});

const updateAnimalArgsSchema = z
  .object({
    animalId: z.string().cuid().optional(),
    animalName: z.string().trim().min(2).max(200).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    species: z.string().trim().max(100).nullable().optional(),
  })
  .refine((value) => Boolean(value.animalId || value.animalName), {
    message: "Donnez animalId ou animalName.",
    path: ["animalId"],
  })
  .refine(
    (value) => value.name !== undefined || value.species !== undefined,
    {
      message: "Aucun champ à modifier. Fournis name et/ou species.",
      path: ["name"],
    }
  );

const deleteAnimalArgsSchema = z
  .object({
    animalId: z.string().cuid().optional(),
    animalName: z.string().trim().min(2).max(200).optional(),
  })
  .refine((value) => Boolean(value.animalId || value.animalName), {
    message: "Donnez animalId ou animalName.",
    path: ["animalId"],
  });

const createPersonArgsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  relation: z.string().trim().max(100).optional(),
});

const updatePersonArgsSchema = z
  .object({
    personId: z.string().cuid().optional(),
    personName: z.string().trim().min(2).max(200).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    relation: z.string().trim().max(100).nullable().optional(),
  })
  .refine((value) => Boolean(value.personId || value.personName), {
    message: "Donnez personId ou personName.",
    path: ["personId"],
  })
  .refine(
    (value) => value.name !== undefined || value.relation !== undefined,
    {
      message: "Aucun champ à modifier. Fournis name et/ou relation.",
      path: ["name"],
    }
  );

const deletePersonArgsSchema = z
  .object({
    personId: z.string().cuid().optional(),
    personName: z.string().trim().min(2).max(200).optional(),
  })
  .refine((value) => Boolean(value.personId || value.personName), {
    message: "Donnez personId ou personName.",
    path: ["personId"],
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
  amount: z.number().positive().max(1_000_000),
  occurredOn: z.string().regex(dateRegex).optional(),
  isForecast: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const deleteBudgetEntryArgsSchema = z
  .object({
    entryId: z.string().cuid().optional(),
    label: z.string().trim().min(1).max(200).optional(),
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
  })
  .refine((value) => Boolean(value.entryId || value.label), {
    message: "Donnez entryId ou label.",
    path: ["entryId"],
  });

const createBudgetRecurringEntryArgsSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  label: z.string().trim().min(1).max(200),
  amount: z.number().positive().max(1_000_000),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  startMonth: z.string().regex(monthRegex).optional(),
  endMonth: z.string().regex(monthRegex).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const deleteBudgetRecurringEntryArgsSchema = z
  .object({
    recurringEntryId: z.string().cuid().optional(),
    recurringEntryLabel: z.string().trim().min(1).max(200).optional(),
    recurringEntryType: z.enum(["INCOME", "EXPENSE"]).optional(),
  })
  .refine((value) => Boolean(value.recurringEntryId || value.recurringEntryLabel), {
    message: "Donnez recurringEntryId ou recurringEntryLabel.",
    path: ["recurringEntryId"],
  });

const updateBudgetRecurringEntryArgsSchema = z
  .object({
    recurringEntryId: z.string().cuid().optional(),
    recurringEntryLabel: z.string().trim().min(1).max(200).optional(),
    recurringEntryType: z.enum(["INCOME", "EXPENSE"]).optional(),
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    label: z.string().trim().min(1).max(200).optional(),
    amount: z.number().positive().max(1_000_000).optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    startMonth: z.string().regex(monthRegex).optional(),
    endMonth: z.string().regex(monthRegex).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => Boolean(value.recurringEntryId || value.recurringEntryLabel), {
    message: "Donnez recurringEntryId ou recurringEntryLabel.",
    path: ["recurringEntryId"],
  })
  .refine(
    (value) =>
      value.type !== undefined ||
      value.label !== undefined ||
      value.amount !== undefined ||
      value.dayOfMonth !== undefined ||
      value.startMonth !== undefined ||
      value.endMonth !== undefined ||
      value.notes !== undefined,
    {
      message:
        "Aucun champ à modifier. Fournis au moins un des champs: type, label, amount, dayOfMonth, startMonth, endMonth ou notes.",
      path: ["type"],
    }
  );

const listMonthlyBudgetArgsSchema = z.object({
  month: z.string().regex(monthRegex).optional(),
});

const createImportantDateArgsSchema = z.object({
  title: z.string().trim().min(2).max(200),
  type: z.enum(["BIRTHDAY", "ANNIVERSARY", "EVENT", "OTHER"]).optional(),
  date: z.string().regex(dateRegex),
  description: z.string().trim().max(500).optional(),
  isRecurringYearly: z.boolean().optional(),
});

const updateImportantDateArgsSchema = z
  .object({
    importantDateId: z.string().cuid().optional(),
    titleMatch: z.string().trim().min(2).max(200).optional(),
    title: z.string().trim().min(2).max(200).optional(),
    type: z.enum(["BIRTHDAY", "ANNIVERSARY", "EVENT", "OTHER"]).optional(),
    date: z.string().regex(dateRegex).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isRecurringYearly: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.importantDateId || value.titleMatch), {
    message: "Donnez importantDateId ou titleMatch.",
    path: ["importantDateId"],
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.type !== undefined ||
      value.date !== undefined ||
      value.description !== undefined ||
      value.isRecurringYearly !== undefined,
    {
      message:
        "Aucun champ à modifier. Fournis au moins un champ de date importante.",
      path: ["title"],
    }
  );

const deleteImportantDateArgsSchema = z
  .object({
    importantDateId: z.string().cuid().optional(),
    titleMatch: z.string().trim().min(2).max(200).optional(),
  })
  .refine((value) => Boolean(value.importantDateId || value.titleMatch), {
    message: "Donnez importantDateId ou titleMatch.",
    path: ["importantDateId"],
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

function formatMonth(date: Date | null) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

async function findBudgetRecurringEntryByIdOrLabel(
  houseId: string,
  recurringEntryId?: string,
  recurringEntryLabel?: string,
  recurringEntryType?: BudgetEntryType
): Promise<BudgetRecurringEntryRecord | null> {
  if (recurringEntryId) {
    return await prisma.budgetRecurringEntry.findFirst({
      where: {
        id: recurringEntryId,
        houseId,
      },
      select: {
        id: true,
        type: true,
        label: true,
        amountCents: true,
        dayOfMonth: true,
        startMonth: true,
        endMonth: true,
        notes: true,
      },
    });
  }

  if (!recurringEntryLabel) {
    return null;
  }

  const label = recurringEntryLabel.trim();
  if (!label) return null;

  const byExactLabel = await prisma.budgetRecurringEntry.findMany({
    where: {
      houseId,
      type: recurringEntryType,
      label: {
        equals: label,
        mode: "insensitive",
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      type: true,
      label: true,
      amountCents: true,
      dayOfMonth: true,
      startMonth: true,
      endMonth: true,
      notes: true,
    },
  });

  if (byExactLabel.length === 1) {
    return byExactLabel[0];
  }

  if (byExactLabel.length > 1) {
    throw new Error(
      "Plusieurs règles récurrentes portent ce libellé. Utilise recurringEntryId pour préciser."
    );
  }

  const byContainsLabel = await prisma.budgetRecurringEntry.findMany({
    where: {
      houseId,
      type: recurringEntryType,
      label: {
        contains: label,
        mode: "insensitive",
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      type: true,
      label: true,
      amountCents: true,
      dayOfMonth: true,
      startMonth: true,
      endMonth: true,
      notes: true,
    },
  });

  if (byContainsLabel.length === 1) {
    return byContainsLabel[0];
  }

  if (byContainsLabel.length > 1) {
    throw new Error(
      "Plusieurs règles récurrentes correspondent à ce libellé. Utilise recurringEntryId pour préciser."
    );
  }

  return null;
}

type NamedRecord = { id: string; name: string };

async function findSingleNamedRecord(
  options: {
    pluralLabel: string;
    name: string;
    byExactName: () => Promise<NamedRecord[]>;
    byContainsName: () => Promise<NamedRecord[]>;
  }
): Promise<NamedRecord | null> {
  const exact = await options.byExactName();
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      `Plusieurs ${options.pluralLabel} portent ce nom. Donne l'identifiant pour préciser.`
    );
  }

  const contains = await options.byContainsName();
  if (contains.length === 1) return contains[0];
  if (contains.length > 1) {
    throw new Error(
      `Plusieurs ${options.pluralLabel} correspondent à ce nom. Donne l'identifiant pour préciser.`
    );
  }

  return null;
}

async function resolveRelationIdByNameForUpdate(
  model: "zone" | "category" | "project" | "equipment" | "animal" | "person",
  houseId: string,
  value: string | null | undefined
) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const id = await resolveRelationIdByName(model, houseId, normalized);
  if (!id) {
    throw new Error(`${model} introuvable: "${normalized}"`);
  }
  return id;
}

async function resolveAssigneeIdForUpdate(
  houseId: string,
  assignee: string | null | undefined
) {
  if (assignee === undefined) return undefined;
  if (assignee === null) return null;
  const normalized = assignee.trim();
  if (!normalized) return null;
  const assigneeId = await resolveAssigneeId(houseId, normalized);
  if (!assigneeId) {
    throw new Error(`Membre introuvable pour assignee: "${normalized}"`);
  }
  return assigneeId;
}

async function findProjectByIdOrName(
  houseId: string,
  projectId?: string,
  projectName?: string
) {
  if (projectId) {
    return await prisma.project.findFirst({
      where: { id: projectId, houseId },
      select: { id: true, name: true },
    });
  }
  if (!projectName) return null;
  const normalized = projectName.trim();
  if (!normalized) return null;
  return await findSingleNamedRecord({
    pluralLabel: "projets",
    name: normalized,
    byExactName: async () =>
      prisma.project.findMany({
        where: { houseId, name: { equals: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
    byContainsName: async () =>
      prisma.project.findMany({
        where: { houseId, name: { contains: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
  });
}

async function findEquipmentByIdOrName(
  houseId: string,
  equipmentId?: string,
  equipmentName?: string
) {
  if (equipmentId) {
    return await prisma.equipment.findFirst({
      where: { id: equipmentId, houseId },
      select: { id: true, name: true },
    });
  }
  if (!equipmentName) return null;
  const normalized = equipmentName.trim();
  if (!normalized) return null;
  return await findSingleNamedRecord({
    pluralLabel: "équipements",
    name: normalized,
    byExactName: async () =>
      prisma.equipment.findMany({
        where: { houseId, name: { equals: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
    byContainsName: async () =>
      prisma.equipment.findMany({
        where: { houseId, name: { contains: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
  });
}

async function findZoneByIdOrName(houseId: string, zoneId?: string, zoneName?: string) {
  if (zoneId) {
    return await prisma.zone.findFirst({
      where: { id: zoneId, houseId },
      select: { id: true, name: true },
    });
  }
  if (!zoneName) return null;
  const normalized = zoneName.trim();
  if (!normalized) return null;
  return await findSingleNamedRecord({
    pluralLabel: "zones",
    name: normalized,
    byExactName: async () =>
      prisma.zone.findMany({
        where: { houseId, name: { equals: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
    byContainsName: async () =>
      prisma.zone.findMany({
        where: { houseId, name: { contains: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
  });
}

async function findCategoryByIdOrName(
  houseId: string,
  categoryId?: string,
  categoryName?: string
) {
  if (categoryId) {
    return await prisma.category.findFirst({
      where: { id: categoryId, houseId },
      select: { id: true, name: true },
    });
  }
  if (!categoryName) return null;
  const normalized = categoryName.trim();
  if (!normalized) return null;
  return await findSingleNamedRecord({
    pluralLabel: "catégories",
    name: normalized,
    byExactName: async () =>
      prisma.category.findMany({
        where: { houseId, name: { equals: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
    byContainsName: async () =>
      prisma.category.findMany({
        where: { houseId, name: { contains: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
  });
}

async function findAnimalByIdOrName(
  houseId: string,
  animalId?: string,
  animalName?: string
) {
  if (animalId) {
    return await prisma.animal.findFirst({
      where: { id: animalId, houseId },
      select: { id: true, name: true },
    });
  }
  if (!animalName) return null;
  const normalized = animalName.trim();
  if (!normalized) return null;
  return await findSingleNamedRecord({
    pluralLabel: "animaux",
    name: normalized,
    byExactName: async () =>
      prisma.animal.findMany({
        where: { houseId, name: { equals: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
    byContainsName: async () =>
      prisma.animal.findMany({
        where: { houseId, name: { contains: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
  });
}

async function findPersonByIdOrName(
  houseId: string,
  personId?: string,
  personName?: string
) {
  if (personId) {
    return await prisma.person.findFirst({
      where: { id: personId, houseId },
      select: { id: true, name: true },
    });
  }
  if (!personName) return null;
  const normalized = personName.trim();
  if (!normalized) return null;
  return await findSingleNamedRecord({
    pluralLabel: "personnes",
    name: normalized,
    byExactName: async () =>
      prisma.person.findMany({
        where: { houseId, name: { equals: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
    byContainsName: async () =>
      prisma.person.findMany({
        where: { houseId, name: { contains: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
  });
}

async function findShoppingListByIdOrName(
  houseId: string,
  shoppingListId?: string,
  shoppingListName?: string
) {
  if (shoppingListId) {
    return await prisma.shoppingList.findFirst({
      where: { id: shoppingListId, houseId },
      select: { id: true, name: true },
    });
  }
  if (!shoppingListName) return null;
  const normalized = shoppingListName.trim();
  if (!normalized) return null;
  return await findSingleNamedRecord({
    pluralLabel: "listes d'achats",
    name: normalized,
    byExactName: async () =>
      prisma.shoppingList.findMany({
        where: { houseId, name: { equals: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
    byContainsName: async () =>
      prisma.shoppingList.findMany({
        where: { houseId, name: { contains: normalized, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true },
      }),
  });
}

async function findShoppingItemByIdOrName(
  houseId: string,
  options: {
    itemId?: string;
    itemName?: string;
    shoppingListId?: string;
    shoppingListName?: string;
  }
) {
  const resolvedList = await findShoppingListByIdOrName(
    houseId,
    options.shoppingListId,
    options.shoppingListName
  );

  if (options.itemId) {
    return await prisma.shoppingListItem.findFirst({
      where: {
        id: options.itemId,
        shoppingList: {
          houseId,
        },
      },
      select: {
        id: true,
        name: true,
        completed: true,
        shoppingListId: true,
      },
    });
  }

  if (!options.itemName) {
    return null;
  }

  const normalized = options.itemName.trim();
  if (!normalized) return null;

  const findCandidates = (mode: "equals" | "contains") =>
    prisma.shoppingListItem.findMany({
      where: {
        name: {
          [mode]: normalized,
          mode: "insensitive",
        },
        shoppingList: {
          houseId,
          ...(resolvedList ? { id: resolvedList.id } : {}),
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        completed: true,
        shoppingListId: true,
      },
    });

  const exact = await findCandidates("equals");
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      "Plusieurs articles portent ce nom. Précise itemId ou shoppingListName."
    );
  }

  const contains = await findCandidates("contains");
  if (contains.length === 1) return contains[0];
  if (contains.length > 1) {
    throw new Error(
      "Plusieurs articles correspondent à ce nom. Précise itemId ou shoppingListName."
    );
  }

  return null;
}

async function findBudgetEntryByIdOrLabel(
  houseId: string,
  entryId?: string,
  label?: string,
  type?: BudgetEntryType
) {
  if (entryId) {
    return await prisma.budgetEntry.findFirst({
      where: { id: entryId, houseId },
      select: {
        id: true,
        type: true,
        label: true,
        amountCents: true,
      },
    });
  }
  if (!label) return null;
  const normalized = label.trim();
  if (!normalized) return null;

  const exact = await prisma.budgetEntry.findMany({
    where: {
      houseId,
      type,
      label: { equals: normalized, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      type: true,
      label: true,
      amountCents: true,
    },
  });

  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      "Plusieurs écritures budget portent ce libellé. Utilise entryId pour préciser."
    );
  }

  const contains = await prisma.budgetEntry.findMany({
    where: {
      houseId,
      type,
      label: { contains: normalized, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      type: true,
      label: true,
      amountCents: true,
    },
  });

  if (contains.length === 1) return contains[0];
  if (contains.length > 1) {
    throw new Error(
      "Plusieurs écritures budget correspondent à ce libellé. Utilise entryId pour préciser."
    );
  }

  return null;
}

async function findImportantDateByIdOrTitle(
  houseId: string,
  importantDateId?: string,
  titleMatch?: string
) {
  if (importantDateId) {
    return await prisma.importantDate.findFirst({
      where: { id: importantDateId, houseId },
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        isRecurringYearly: true,
      },
    });
  }

  if (!titleMatch) return null;
  const normalized = titleMatch.trim();
  if (!normalized) return null;

  const exact = await prisma.importantDate.findMany({
    where: {
      houseId,
      title: { equals: normalized, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      type: true,
      date: true,
      isRecurringYearly: true,
    },
  });

  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      "Plusieurs dates importantes portent ce titre. Utilise importantDateId pour préciser."
    );
  }

  const contains = await prisma.importantDate.findMany({
    where: {
      houseId,
      title: { contains: normalized, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      type: true,
      date: true,
      isRecurringYearly: true,
    },
  });

  if (contains.length === 1) return contains[0];
  if (contains.length > 1) {
    throw new Error(
      "Plusieurs dates importantes correspondent à ce titre. Utilise importantDateId pour préciser."
    );
  }

  return null;
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

    await enqueueTaskIllustration({
      houseId,
      userId,
      taskId: instance.id,
      title: parsed.title,
      description: parsed.description ?? null,
      personId,
      assigneeId,
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

  await enqueueTaskIllustration({
    houseId,
    userId,
    taskId: created.id,
    title: parsed.title,
    description: parsed.description ?? null,
    personId,
    assigneeId,
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

async function toolUpdateTask(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updateTaskArgsSchema.parse(args ?? {});
  const task = await findTaskByIdOrTitle(houseId, parsed.taskId, parsed.taskTitle);

  if (!task) {
    throw new Error("Tâche introuvable. Donnez un id ou un titre plus précis.");
  }

  const [
    zoneId,
    categoryId,
    projectId,
    equipmentId,
    animalId,
    personId,
    assigneeId,
  ] = await Promise.all([
    resolveRelationIdByNameForUpdate("zone", houseId, parsed.zone),
    resolveRelationIdByNameForUpdate("category", houseId, parsed.category),
    resolveRelationIdByNameForUpdate("project", houseId, parsed.project),
    resolveRelationIdByNameForUpdate("equipment", houseId, parsed.equipment),
    resolveRelationIdByNameForUpdate("animal", houseId, parsed.animal),
    resolveRelationIdByNameForUpdate("person", houseId, parsed.person),
    resolveAssigneeIdForUpdate(houseId, parsed.assignee),
  ]);

  const data: {
    title?: string;
    description?: string | null;
    dueDate?: Date | null;
    reminderOffsetDays?: number | null;
    status?: TaskStatus;
    assigneeId?: string | null;
    zoneId?: string | null;
    categoryId?: string | null;
    projectId?: string | null;
    equipmentId?: string | null;
    animalId?: string | null;
    personId?: string | null;
  } = {};

  if (parsed.title !== undefined) {
    data.title = parsed.title;
  }
  if (parsed.description !== undefined) {
    data.description = parsed.description;
  }
  if (parsed.dueDate !== undefined) {
    data.dueDate = parseDateAtNoon(parsed.dueDate);
  }
  if (parsed.reminderOffsetDays !== undefined) {
    data.reminderOffsetDays = parsed.reminderOffsetDays;
  }
  if (parsed.status !== undefined) {
    data.status = parsed.status as TaskStatus;
  }
  if (assigneeId !== undefined) {
    data.assigneeId = assigneeId;
  }
  if (zoneId !== undefined) {
    data.zoneId = zoneId;
  }
  if (categoryId !== undefined) {
    data.categoryId = categoryId;
  }
  if (projectId !== undefined) {
    data.projectId = projectId;
  }
  if (equipmentId !== undefined) {
    data.equipmentId = equipmentId;
  }
  if (animalId !== undefined) {
    data.animalId = animalId;
  }
  if (personId !== undefined) {
    data.personId = personId;
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data,
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

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Tâche modifiée",
    task: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      dueDate: formatDate(updated.dueDate),
      assignee: updated.assignee?.name || updated.assignee?.email || null,
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
  await clearTaskImageGenerating(task.id);
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

async function toolCreateProject(
  args: unknown,
  { userId, houseId }: AgentToolContext
) {
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

  await enqueueProjectIllustration({
    userId,
    projectId: created.id,
    name: parsed.name,
    description: parsed.description ?? null,
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Projet créé",
    project: created,
  });
}

async function toolUpdateProject(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updateProjectArgsSchema.parse(args ?? {});
  const project = await findProjectByIdOrName(
    houseId,
    parsed.projectId,
    parsed.projectName
  );

  if (!project) {
    throw new Error("Projet introuvable. Donnez projectId ou projectName plus précis.");
  }

  const data: {
    name?: string;
    description?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
  } = {};

  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.startsAt !== undefined) data.startsAt = parseDateAtNoon(parsed.startsAt);
  if (parsed.endsAt !== undefined) data.endsAt = parseDateAtNoon(parsed.endsAt);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
    select: {
      id: true,
      name: true,
      description: true,
      startsAt: true,
      endsAt: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Projet modifié",
    project: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      startsAt: formatDate(updated.startsAt),
      endsAt: formatDate(updated.endsAt),
    },
  });
}

async function toolDeleteProject(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deleteProjectArgsSchema.parse(args ?? {});
  const project = await findProjectByIdOrName(
    houseId,
    parsed.projectId,
    parsed.projectName
  );

  if (!project) {
    throw new Error("Projet introuvable. Donnez projectId ou projectName plus précis.");
  }

  await prisma.project.delete({
    where: { id: project.id },
  });
  await removeStoredProjectImageVariants(project.id);
  await clearProjectImageGenerating(project.id);

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Projet supprimé",
    project,
  });
}

async function toolCreateEquipment(args: unknown, { userId, houseId }: AgentToolContext) {
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

  await enqueueEquipmentIllustration({
    userId,
    equipmentId: created.id,
    name: parsed.name,
    location: parsed.location ?? null,
    category: parsed.category ?? null,
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Équipement créé",
    equipment: created,
  });
}

async function toolUpdateEquipment(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updateEquipmentArgsSchema.parse(args ?? {});
  const equipment = await findEquipmentByIdOrName(
    houseId,
    parsed.equipmentId,
    parsed.equipmentName
  );

  if (!equipment) {
    throw new Error(
      "Équipement introuvable. Donnez equipmentId ou equipmentName plus précis."
    );
  }

  const data: {
    name?: string;
    location?: string | null;
    category?: string | null;
    purchasedAt?: Date | null;
    installedAt?: Date | null;
    lifespanMonths?: number | null;
  } = {};

  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.location !== undefined) data.location = parsed.location;
  if (parsed.category !== undefined) data.category = parsed.category;
  if (parsed.purchasedAt !== undefined) {
    data.purchasedAt = parseDateAtNoon(parsed.purchasedAt);
  }
  if (parsed.installedAt !== undefined) {
    data.installedAt = parseDateAtNoon(parsed.installedAt);
  }
  if (parsed.lifespanMonths !== undefined) data.lifespanMonths = parsed.lifespanMonths;

  const updated = await prisma.equipment.update({
    where: { id: equipment.id },
    data,
    select: {
      id: true,
      name: true,
      location: true,
      category: true,
      purchasedAt: true,
      installedAt: true,
      lifespanMonths: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Équipement modifié",
    equipment: {
      id: updated.id,
      name: updated.name,
      location: updated.location,
      category: updated.category,
      purchasedAt: formatDate(updated.purchasedAt),
      installedAt: formatDate(updated.installedAt),
      lifespanMonths: updated.lifespanMonths,
    },
  });
}

async function toolDeleteEquipment(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deleteEquipmentArgsSchema.parse(args ?? {});
  const equipment = await findEquipmentByIdOrName(
    houseId,
    parsed.equipmentId,
    parsed.equipmentName
  );

  if (!equipment) {
    throw new Error(
      "Équipement introuvable. Donnez equipmentId ou equipmentName plus précis."
    );
  }

  await prisma.equipment.delete({
    where: { id: equipment.id },
  });
  await removeStoredEquipmentImageVariants(equipment.id);
  await clearEquipmentImageGenerating(equipment.id);

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Équipement supprimé",
    equipment,
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

async function toolDeleteShoppingList(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deleteShoppingListArgsSchema.parse(args ?? {});
  const shoppingList = await findShoppingListByIdOrName(
    houseId,
    parsed.shoppingListId,
    parsed.shoppingListName
  );

  if (!shoppingList) {
    throw new Error(
      "Liste d'achats introuvable. Donnez shoppingListId ou shoppingListName plus précis."
    );
  }

  await prisma.shoppingList.delete({
    where: { id: shoppingList.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Liste d'achats supprimée",
    shoppingList,
  });
}

async function toolClearShoppingList(args: unknown, { houseId }: AgentToolContext) {
  const parsed = clearShoppingListArgsSchema.parse(args ?? {});
  const shoppingList = await findShoppingListByIdOrName(
    houseId,
    parsed.shoppingListId,
    parsed.shoppingListName
  );

  if (!shoppingList) {
    throw new Error(
      "Liste d'achats introuvable. Donnez shoppingListId ou shoppingListName plus précis."
    );
  }

  const deleted = await prisma.shoppingListItem.deleteMany({
    where: { shoppingListId: shoppingList.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Liste d'achats vidée",
    shoppingList,
    removedItems: deleted.count,
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

async function toolToggleShoppingItem(args: unknown, { houseId }: AgentToolContext) {
  const parsed = toggleShoppingItemArgsSchema.parse(args ?? {});

  const item = await findShoppingItemByIdOrName(houseId, {
    itemId: parsed.itemId,
    itemName: parsed.itemName,
    shoppingListId: parsed.shoppingListId,
    shoppingListName: parsed.shoppingListName,
  });

  if (!item) {
    throw new Error("Article introuvable. Donnez itemId ou itemName plus précis.");
  }

  const updated = await prisma.shoppingListItem.update({
    where: { id: item.id },
    data: { completed: parsed.completed },
    select: {
      id: true,
      name: true,
      completed: true,
      shoppingListId: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: updated.completed ? "Article marqué comme fait" : "Article rouvert",
    item: updated,
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

async function toolDeleteBudgetEntry(args: unknown, { houseId }: AgentToolContext) {
  ensureBudgetFeatureAvailable();
  const parsed = deleteBudgetEntryArgsSchema.parse(args ?? {});
  const entry = await findBudgetEntryByIdOrLabel(
    houseId,
    parsed.entryId,
    parsed.label,
    parsed.type as BudgetEntryType | undefined
  );

  if (!entry) {
    throw new Error("Écriture budget introuvable. Donnez entryId ou label plus précis.");
  }

  await prisma.budgetEntry.delete({
    where: { id: entry.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Écriture budget supprimée",
    budgetEntry: {
      id: entry.id,
      type: entry.type,
      label: entry.label,
      amount: formatEuroFromAmount(entry.amountCents),
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

async function toolUpdateBudgetRecurringEntry(
  args: unknown,
  { houseId }: AgentToolContext
) {
  ensureBudgetFeatureAvailable();
  const parsed = updateBudgetRecurringEntryArgsSchema.parse(args ?? {});

  const recurringEntry = await findBudgetRecurringEntryByIdOrLabel(
    houseId,
    parsed.recurringEntryId,
    parsed.recurringEntryLabel,
    parsed.recurringEntryType as BudgetEntryType | undefined
  );

  if (!recurringEntry) {
    throw new Error("Règle récurrente introuvable");
  }

  const data: {
    type?: BudgetEntryType;
    label?: string;
    amountCents?: number;
    dayOfMonth?: number | null;
    startMonth?: Date;
    endMonth?: Date | null;
    notes?: string | null;
  } = {};

  if (parsed.type !== undefined) {
    data.type = parsed.type as BudgetEntryType;
  }

  if (parsed.label !== undefined) {
    data.label = parsed.label;
  }

  if (parsed.amount !== undefined) {
    data.amountCents = Math.round(parsed.amount * 100);
  }

  if (parsed.dayOfMonth !== undefined) {
    data.dayOfMonth = parsed.dayOfMonth;
  }

  if (parsed.startMonth !== undefined) {
    data.startMonth = parseMonthRange(parsed.startMonth).start;
  }

  if (parsed.endMonth !== undefined) {
    data.endMonth = parsed.endMonth
      ? parseMonthRange(parsed.endMonth).start
      : null;
  }

  if (parsed.notes !== undefined) {
    data.notes = parsed.notes === null ? null : parsed.notes.trim() || null;
  }

  const nextStartMonth = data.startMonth ?? recurringEntry.startMonth;
  const nextEndMonth =
    data.endMonth !== undefined ? data.endMonth : recurringEntry.endMonth;

  if (nextEndMonth && nextEndMonth.getTime() < nextStartMonth.getTime()) {
    throw new Error("Le mois de fin doit être postérieur ou égal au mois de début.");
  }

  const updated = await prisma.budgetRecurringEntry.update({
    where: { id: recurringEntry.id },
    data,
    select: {
      id: true,
      type: true,
      label: true,
      amountCents: true,
      dayOfMonth: true,
      startMonth: true,
      endMonth: true,
      notes: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message:
      updated.type === "INCOME"
        ? "Revenu récurrent modifié"
        : "Dépense récurrente modifiée",
    recurringEntry: {
      id: updated.id,
      type: updated.type,
      label: updated.label,
      amount: formatEuroFromAmount(updated.amountCents),
      dayOfMonth: updated.dayOfMonth,
      startMonth: formatMonth(updated.startMonth),
      endMonth: formatMonth(updated.endMonth),
      notes: updated.notes,
    },
  });
}

async function toolDeleteBudgetRecurringEntry(
  args: unknown,
  { houseId }: AgentToolContext
) {
  ensureBudgetFeatureAvailable();
  const parsed = deleteBudgetRecurringEntryArgsSchema.parse(args ?? {});

  const recurringEntry = await findBudgetRecurringEntryByIdOrLabel(
    houseId,
    parsed.recurringEntryId,
    parsed.recurringEntryLabel,
    parsed.recurringEntryType as BudgetEntryType | undefined
  );

  if (!recurringEntry) {
    throw new Error("Règle récurrente introuvable");
  }

  await prisma.budgetRecurringEntry.delete({
    where: { id: recurringEntry.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message:
      recurringEntry.type === "INCOME"
        ? "Revenu récurrent supprimé"
        : "Dépense récurrente supprimée",
    recurringEntry: {
      id: recurringEntry.id,
      type: recurringEntry.type,
      label: recurringEntry.label,
      amount: formatEuroFromAmount(recurringEntry.amountCents),
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
    .filter((entry) => entry.amountCents > 0)
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
    ...entries
      .filter((entry) => entry.amountCents > 0)
      .map((entry) => ({
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

async function toolUpdateZone(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updateNamedEntityArgsSchema.parse(args ?? {});
  const zone = await findZoneByIdOrName(houseId, parsed.id, parsed.currentName);

  if (!zone) {
    throw new Error("Zone introuvable. Donnez id ou currentName plus précis.");
  }

  const updated = await prisma.zone.update({
    where: { id: zone.id },
    data: { name: parsed.name },
    select: {
      id: true,
      name: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Zone modifiée",
    zone: updated,
  });
}

async function toolDeleteZone(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deleteNamedEntityArgsSchema.parse(args ?? {});
  const zone = await findZoneByIdOrName(houseId, parsed.id, parsed.name);

  if (!zone) {
    throw new Error("Zone introuvable. Donnez id ou name plus précis.");
  }

  await prisma.zone.delete({
    where: { id: zone.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Zone supprimée",
    zone,
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

async function toolUpdateCategory(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updateNamedEntityArgsSchema.parse(args ?? {});
  const category = await findCategoryByIdOrName(
    houseId,
    parsed.id,
    parsed.currentName
  );

  if (!category) {
    throw new Error("Catégorie introuvable. Donnez id ou currentName plus précis.");
  }

  const updated = await prisma.category.update({
    where: { id: category.id },
    data: { name: parsed.name },
    select: {
      id: true,
      name: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Catégorie modifiée",
    category: updated,
  });
}

async function toolDeleteCategory(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deleteNamedEntityArgsSchema.parse(args ?? {});
  const category = await findCategoryByIdOrName(houseId, parsed.id, parsed.name);

  if (!category) {
    throw new Error("Catégorie introuvable. Donnez id ou name plus précis.");
  }

  await prisma.category.delete({
    where: { id: category.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Catégorie supprimée",
    category,
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

async function toolUpdateAnimal(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updateAnimalArgsSchema.parse(args ?? {});
  const animal = await findAnimalByIdOrName(
    houseId,
    parsed.animalId,
    parsed.animalName
  );

  if (!animal) {
    throw new Error("Animal introuvable. Donnez animalId ou animalName plus précis.");
  }

  const updated = await prisma.animal.update({
    where: { id: animal.id },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.species !== undefined ? { species: parsed.species } : {}),
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
    message: "Animal modifié",
    animal: updated,
  });
}

async function toolDeleteAnimal(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deleteAnimalArgsSchema.parse(args ?? {});
  const animal = await findAnimalByIdOrName(
    houseId,
    parsed.animalId,
    parsed.animalName
  );

  if (!animal) {
    throw new Error("Animal introuvable. Donnez animalId ou animalName plus précis.");
  }

  await prisma.animal.delete({
    where: { id: animal.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Animal supprimé",
    animal,
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

async function toolUpdatePerson(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updatePersonArgsSchema.parse(args ?? {});
  const person = await findPersonByIdOrName(
    houseId,
    parsed.personId,
    parsed.personName
  );

  if (!person) {
    throw new Error("Personne introuvable. Donnez personId ou personName plus précis.");
  }

  const updated = await prisma.person.update({
    where: { id: person.id },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.relation !== undefined ? { relation: parsed.relation } : {}),
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
    message: "Personne modifiée",
    person: updated,
  });
}

async function toolDeletePerson(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deletePersonArgsSchema.parse(args ?? {});
  const person = await findPersonByIdOrName(
    houseId,
    parsed.personId,
    parsed.personName
  );

  if (!person) {
    throw new Error("Personne introuvable. Donnez personId ou personName plus précis.");
  }

  await prisma.person.delete({
    where: { id: person.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Personne supprimée",
    person,
  });
}

async function toolCreateImportantDate(
  args: unknown,
  { userId, houseId }: AgentToolContext
) {
  const parsed = createImportantDateArgsSchema.parse(args ?? {});
  const created = await prisma.importantDate.create({
    data: {
      houseId,
      createdById: userId,
      title: parsed.title,
      type: (parsed.type ?? "OTHER") as ImportantDateType,
      date: parseDateAtNoon(parsed.date) as Date,
      description: parsed.description ?? null,
      isRecurringYearly: parsed.isRecurringYearly ?? true,
    },
    select: {
      id: true,
      title: true,
      type: true,
      date: true,
      isRecurringYearly: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Date importante créée",
    importantDate: {
      id: created.id,
      title: created.title,
      type: created.type,
      date: formatDate(created.date),
      isRecurringYearly: created.isRecurringYearly,
    },
  });
}

async function toolUpdateImportantDate(args: unknown, { houseId }: AgentToolContext) {
  const parsed = updateImportantDateArgsSchema.parse(args ?? {});
  const importantDate = await findImportantDateByIdOrTitle(
    houseId,
    parsed.importantDateId,
    parsed.titleMatch
  );

  if (!importantDate) {
    throw new Error(
      "Date importante introuvable. Donnez importantDateId ou titleMatch plus précis."
    );
  }
  const parsedDate = parsed.date !== undefined ? parseDateAtNoon(parsed.date) : undefined;
  if (parsed.date !== undefined && !parsedDate) {
    throw new Error("Date invalide. Utilise le format YYYY-MM-DD.");
  }

  const updated = await prisma.importantDate.update({
    where: { id: importantDate.id },
    data: {
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.type !== undefined ? { type: parsed.type as ImportantDateType } : {}),
      ...(parsedDate ? { date: parsedDate } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.isRecurringYearly !== undefined
        ? { isRecurringYearly: parsed.isRecurringYearly }
        : {}),
    },
    select: {
      id: true,
      title: true,
      type: true,
      date: true,
      description: true,
      isRecurringYearly: true,
    },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Date importante modifiée",
    importantDate: {
      id: updated.id,
      title: updated.title,
      type: updated.type,
      date: formatDate(updated.date),
      description: updated.description,
      isRecurringYearly: updated.isRecurringYearly,
    },
  });
}

async function toolDeleteImportantDate(args: unknown, { houseId }: AgentToolContext) {
  const parsed = deleteImportantDateArgsSchema.parse(args ?? {});
  const importantDate = await findImportantDateByIdOrTitle(
    houseId,
    parsed.importantDateId,
    parsed.titleMatch
  );

  if (!importantDate) {
    throw new Error(
      "Date importante introuvable. Donnez importantDateId ou titleMatch plus précis."
    );
  }

  await prisma.importantDate.delete({
    where: { id: importantDate.id },
  });

  revalidateAppPaths();

  return asToolResult({
    ok: true,
    message: "Date importante supprimée",
    importantDate: {
      id: importantDate.id,
      title: importantDate.title,
      type: importantDate.type,
      date: formatDate(importantDate.date),
      isRecurringYearly: importantDate.isRecurringYearly,
    },
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
    name: "update_task",
    description: "Modifie une tâche via son id ou son titre.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        taskTitle: { type: "string" },
        title: { type: "string" },
        description: { type: ["string", "null"] },
        dueDate: { type: ["string", "null"], description: "Date YYYY-MM-DD" },
        reminderOffsetDays: { type: ["integer", "null"], minimum: 0, maximum: 365 },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
        },
        assignee: { type: ["string", "null"], description: "Nom ou email d'un membre" },
        zone: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
        project: { type: ["string", "null"] },
        equipment: { type: ["string", "null"] },
        animal: { type: ["string", "null"] },
        person: { type: ["string", "null"] },
      },
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
    name: "update_project",
    description: "Modifie un projet via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        name: { type: "string" },
        description: { type: ["string", "null"] },
        startsAt: { type: ["string", "null"], description: "Date YYYY-MM-DD" },
        endsAt: { type: ["string", "null"], description: "Date YYYY-MM-DD" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_project",
    description: "Supprime un projet via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
      },
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
    name: "update_equipment",
    description: "Modifie un équipement via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        equipmentId: { type: "string" },
        equipmentName: { type: "string" },
        name: { type: "string" },
        location: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
        purchasedAt: { type: ["string", "null"], description: "Date YYYY-MM-DD" },
        installedAt: { type: ["string", "null"], description: "Date YYYY-MM-DD" },
        lifespanMonths: { type: ["integer", "null"], minimum: 1, maximum: 1200 },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_equipment",
    description: "Supprime un équipement via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        equipmentId: { type: "string" },
        equipmentName: { type: "string" },
      },
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
    name: "delete_shopping_list",
    description: "Supprime une liste d'achats via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        shoppingListId: { type: "string" },
        shoppingListName: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "clear_shopping_list",
    description: "Vide tous les articles d'une liste d'achats.",
    parameters: {
      type: "object",
      properties: {
        shoppingListId: { type: "string" },
        shoppingListName: { type: "string" },
      },
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
    name: "toggle_shopping_item",
    description:
      "Marque un article de liste d'achats comme fait/non fait via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        itemName: { type: "string" },
        shoppingListId: { type: "string" },
        shoppingListName: { type: "string" },
        completed: { type: "boolean" },
      },
      required: ["completed"],
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
    name: "delete_budget_entry",
    description: "Supprime une écriture budget via son id ou son libellé.",
    parameters: {
      type: "object",
      properties: {
        entryId: { type: "string" },
        label: { type: "string" },
        type: { type: "string", enum: ["INCOME", "EXPENSE"] },
      },
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
    name: "update_budget_recurring_entry",
    description:
      "Modifie une règle de dépense/revenu récurrent mensuel via son id ou son libellé.",
    parameters: {
      type: "object",
      properties: {
        recurringEntryId: { type: "string" },
        recurringEntryLabel: { type: "string" },
        recurringEntryType: { type: "string", enum: ["INCOME", "EXPENSE"] },
        type: { type: "string", enum: ["INCOME", "EXPENSE"] },
        label: { type: "string" },
        amount: {
          type: "number",
          description: "Montant en euros, par ex: 95.4",
        },
        dayOfMonth: {
          type: ["integer", "null"],
          minimum: 1,
          maximum: 31,
          description: "Jour du mois (ou null pour retirer le jour fixe)",
        },
        startMonth: { type: "string", description: "Mois YYYY-MM" },
        endMonth: {
          type: ["string", "null"],
          description: "Mois YYYY-MM (ou null pour retirer la fin)",
        },
        notes: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_budget_recurring_entry",
    description:
      "Supprime une règle de dépense/revenu récurrent mensuel via son id ou son libellé.",
    parameters: {
      type: "object",
      properties: {
        recurringEntryId: { type: "string" },
        recurringEntryLabel: { type: "string" },
        recurringEntryType: { type: "string", enum: ["INCOME", "EXPENSE"] },
      },
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
    name: "create_important_date",
    description: "Crée une date importante (anniversaire, événement, etc.).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        type: {
          type: "string",
          enum: ["BIRTHDAY", "ANNIVERSARY", "EVENT", "OTHER"],
        },
        date: { type: "string", description: "Date YYYY-MM-DD" },
        description: { type: "string" },
        isRecurringYearly: { type: "boolean" },
      },
      required: ["title", "date"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_important_date",
    description: "Modifie une date importante via son id ou son titre.",
    parameters: {
      type: "object",
      properties: {
        importantDateId: { type: "string" },
        titleMatch: { type: "string" },
        title: { type: "string" },
        type: {
          type: "string",
          enum: ["BIRTHDAY", "ANNIVERSARY", "EVENT", "OTHER"],
        },
        date: { type: "string", description: "Date YYYY-MM-DD" },
        description: { type: ["string", "null"] },
        isRecurringYearly: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_important_date",
    description: "Supprime une date importante via son id ou son titre.",
    parameters: {
      type: "object",
      properties: {
        importantDateId: { type: "string" },
        titleMatch: { type: "string" },
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
    name: "update_zone",
    description: "Modifie une zone via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        currentName: { type: "string" },
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_zone",
    description: "Supprime une zone via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
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
    name: "update_category",
    description: "Modifie une catégorie via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        currentName: { type: "string" },
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_category",
    description: "Supprime une catégorie via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
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
    name: "update_animal",
    description: "Modifie un animal via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        animalId: { type: "string" },
        animalName: { type: "string" },
        name: { type: "string" },
        species: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_animal",
    description: "Supprime un animal via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        animalId: { type: "string" },
        animalName: { type: "string" },
      },
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
  {
    type: "function",
    name: "update_person",
    description: "Modifie une personne via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        personId: { type: "string" },
        personName: { type: "string" },
        name: { type: "string" },
        relation: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_person",
    description: "Supprime une personne via son id ou son nom.",
    parameters: {
      type: "object",
      properties: {
        personId: { type: "string" },
        personName: { type: "string" },
      },
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
    if (toolName === "update_task") {
      return await toolUpdateTask(args, context);
    }
    if (toolName === "delete_task") {
      return await toolDeleteTask(args, context);
    }
    if (toolName === "create_project") {
      return await toolCreateProject(args, context);
    }
    if (toolName === "update_project") {
      return await toolUpdateProject(args, context);
    }
    if (toolName === "delete_project") {
      return await toolDeleteProject(args, context);
    }
    if (toolName === "create_equipment") {
      return await toolCreateEquipment(args, context);
    }
    if (toolName === "update_equipment") {
      return await toolUpdateEquipment(args, context);
    }
    if (toolName === "delete_equipment") {
      return await toolDeleteEquipment(args, context);
    }
    if (toolName === "create_shopping_list") {
      return await toolCreateShoppingList(args, context);
    }
    if (toolName === "delete_shopping_list") {
      return await toolDeleteShoppingList(args, context);
    }
    if (toolName === "clear_shopping_list") {
      return await toolClearShoppingList(args, context);
    }
    if (toolName === "add_shopping_item") {
      return await toolAddShoppingItem(args, context);
    }
    if (toolName === "toggle_shopping_item") {
      return await toolToggleShoppingItem(args, context);
    }
    if (toolName === "create_budget_entry") {
      return await toolCreateBudgetEntry(args, context);
    }
    if (toolName === "delete_budget_entry") {
      return await toolDeleteBudgetEntry(args, context);
    }
    if (toolName === "create_budget_recurring_entry") {
      return await toolCreateBudgetRecurringEntry(args, context);
    }
    if (toolName === "update_budget_recurring_entry") {
      return await toolUpdateBudgetRecurringEntry(args, context);
    }
    if (toolName === "delete_budget_recurring_entry") {
      return await toolDeleteBudgetRecurringEntry(args, context);
    }
    if (toolName === "list_monthly_budget") {
      return await toolListMonthlyBudget(args, context);
    }
    if (toolName === "create_important_date") {
      return await toolCreateImportantDate(args, context);
    }
    if (toolName === "update_important_date") {
      return await toolUpdateImportantDate(args, context);
    }
    if (toolName === "delete_important_date") {
      return await toolDeleteImportantDate(args, context);
    }
    if (toolName === "create_zone") {
      return await toolCreateZone(args, context);
    }
    if (toolName === "update_zone") {
      return await toolUpdateZone(args, context);
    }
    if (toolName === "delete_zone") {
      return await toolDeleteZone(args, context);
    }
    if (toolName === "create_category") {
      return await toolCreateCategory(args, context);
    }
    if (toolName === "update_category") {
      return await toolUpdateCategory(args, context);
    }
    if (toolName === "delete_category") {
      return await toolDeleteCategory(args, context);
    }
    if (toolName === "create_animal") {
      return await toolCreateAnimal(args, context);
    }
    if (toolName === "update_animal") {
      return await toolUpdateAnimal(args, context);
    }
    if (toolName === "delete_animal") {
      return await toolDeleteAnimal(args, context);
    }
    if (toolName === "create_person") {
      return await toolCreatePerson(args, context);
    }
    if (toolName === "update_person") {
      return await toolUpdatePerson(args, context);
    }
    if (toolName === "delete_person") {
      return await toolDeletePerson(args, context);
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
