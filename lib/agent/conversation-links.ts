export type ConversationLinkSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function buildConversationHref({
  pathname = "",
  searchParams,
  conversationId,
}: {
  pathname?: string;
  searchParams?: ConversationLinkSearchParams;
  conversationId: string;
}) {
  const params = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      }
    }
  }

  params.set("agentConversationId", conversationId);
  const query = params.toString();

  return `${pathname}${query ? `?${query}` : ""}`;
}

export function groupConversationLinks<T extends { entityId: string }>(
  links: T[]
) {
  const grouped = new Map<string, T[]>();
  for (const link of links) {
    const existing = grouped.get(link.entityId);
    if (existing) {
      existing.push(link);
    } else {
      grouped.set(link.entityId, [link]);
    }
  }
  return grouped;
}
