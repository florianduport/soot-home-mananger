export type MarketplaceTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  cadence: "Ponctuel" | "Récurrent";
  recurrenceUnit: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
  recurrenceInterval: number | null;
  reminderOffsetDays: number | null;
  defaultDueOffsetDays: number | null;
  rating: number;
  reviewCount: number;
  source: string;
};

export const marketplaceTemplates: MarketplaceTemplate[] = [
  {
    id: "template-kitchen-deep-clean",
    title: "Grand nettoyage de la cuisine",
    description:
      "Dégraisser les surfaces, nettoyer le four, vider le frigo et refaire les stocks essentiels.",
    category: "Entretien",
    cadence: "Récurrent",
    recurrenceUnit: "MONTHLY",
    recurrenceInterval: 1,
    reminderOffsetDays: 2,
    defaultDueOffsetDays: 7,
    rating: 4.8,
    reviewCount: 126,
    source: "Communauté",
  },
  {
    id: "template-air-filters",
    title: "Changer les filtres d'air",
    description:
      "Vérifier et remplacer les filtres d'aération (clim/chauffage) pour une meilleure qualité d'air.",
    category: "Maintenance",
    cadence: "Récurrent",
    recurrenceUnit: "MONTHLY",
    recurrenceInterval: 3,
    reminderOffsetDays: 3,
    defaultDueOffsetDays: 14,
    rating: 4.6,
    reviewCount: 88,
    source: "Maison HQ",
  },
  {
    id: "template-garden-spring",
    title: "Préparer le jardin pour le printemps",
    description:
      "Nettoyage, taille, ajout d'engrais et planification des plantations.",
    category: "Extérieur",
    cadence: "Ponctuel",
    recurrenceUnit: null,
    recurrenceInterval: null,
    reminderOffsetDays: 5,
    defaultDueOffsetDays: 10,
    rating: 4.7,
    reviewCount: 54,
    source: "Communauté",
  },
  {
    id: "template-budget-check",
    title: "Revue budgétaire mensuelle",
    description:
      "Analyser les dépenses du mois et ajuster les budgets de la maison.",
    category: "Finance",
    cadence: "Récurrent",
    recurrenceUnit: "MONTHLY",
    recurrenceInterval: 1,
    reminderOffsetDays: 1,
    defaultDueOffsetDays: 3,
    rating: 4.5,
    reviewCount: 41,
    source: "Finance Club",
  },
  {
    id: "template-safety-check",
    title: "Vérifier les détecteurs de fumée",
    description:
      "Tester les détecteurs, remplacer les piles si nécessaire.",
    category: "Sécurité",
    cadence: "Récurrent",
    recurrenceUnit: "YEARLY",
    recurrenceInterval: 1,
    reminderOffsetDays: 7,
    defaultDueOffsetDays: 21,
    rating: 4.9,
    reviewCount: 203,
    source: "Communauté",
  },
  {
    id: "template-family-meeting",
    title: "Réunion maison express",
    description:
      "15 minutes pour répartir les tâches et partager les priorités de la semaine.",
    category: "Organisation",
    cadence: "Récurrent",
    recurrenceUnit: "WEEKLY",
    recurrenceInterval: 1,
    reminderOffsetDays: 0,
    defaultDueOffsetDays: 2,
    rating: 4.4,
    reviewCount: 32,
    source: "Soot",
  },
];

export function getMarketplaceTemplate(templateId: string) {
  return marketplaceTemplates.find((template) => template.id === templateId) ?? null;
}

export function getMarketplaceCategories() {
  return Array.from(
    new Set(marketplaceTemplates.map((template) => template.category))
  ).sort((a, b) => a.localeCompare(b, "fr"));
}
