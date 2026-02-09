"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  FileText,
  History,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
};

type ChatAttachment = {
  id?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  path?: string;
  localUrl?: string;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  attachments: ChatAttachment[];
  isPending?: boolean;
};

const MAX_ATTACHMENTS = 8;

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} o`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} Ko`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isImageAttachment(attachment: ChatAttachment) {
  return attachment.mimeType.startsWith("image/");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new Error(payload.error || "Erreur API");
  }

  return payload;
}

export function AgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [deepLinkConversationId, setDeepLinkConversationId] = useState<string | null>(
    null
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ||
      null,
    [activeConversationId, conversations]
  );

  const canSend = input.trim().length > 0 || composerFiles.length > 0;
  const normalizedSearch = conversationSearch.trim().toLowerCase();
  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) return conversations;
    return conversations.filter((conversation) => {
      const title = conversation.title.toLowerCase();
      const preview = conversation.preview.toLowerCase();
      return title.includes(normalizedSearch) || preview.includes(normalizedSearch);
    });
  }, [conversations, normalizedSearch]);

  useEffect(() => {
    if (!isOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isMobileHistoryOpen) {
          setIsMobileHistoryOpen(false);
          return;
        }
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [isOpen, isMobileHistoryOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get("agentConversationId");
    if (!conversationId) return;

    params.delete("agentConversationId");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${
      window.location.hash
    }`;
    window.history.replaceState({}, "", nextUrl);

    setDeepLinkConversationId(conversationId);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      setIsLoadingConversations(true);
      setError(null);
      try {
        const payload = await fetchJson<{
          conversations: ConversationSummary[];
        }>("/api/agent/conversations");
        setConversations(payload.conversations);
        setActiveConversationId((current) => {
          if (current && payload.conversations.some((item) => item.id === current)) {
            return current;
          }
          return null;
        });
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Impossible de charger les conversations"
        );
      } finally {
        setIsLoadingConversations(false);
      }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !deepLinkConversationId) return;
    setActiveConversationId(deepLinkConversationId);
    setIsMobileHistoryOpen(false);
    void reloadConversations(deepLinkConversationId);
    setDeepLinkConversationId(null);
  }, [deepLinkConversationId, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsMobileHistoryOpen(false);
      setConversationSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeConversationId) {
      if (!activeConversationId) {
        setMessages([]);
      }
      return;
    }

    void (async () => {
      setIsLoadingMessages(true);
      setError(null);
      try {
        const payload = await fetchJson<{
          messages: ChatMessage[];
        }>(`/api/agent/conversations/${activeConversationId}`);
        setMessages(payload.messages);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Impossible de charger les messages"
        );
      } finally {
        setIsLoadingMessages(false);
      }
    })();
  }, [activeConversationId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoadingMessages, isSending]);

  async function reloadConversations(preferredId?: string) {
    const payload = await fetchJson<{ conversations: ConversationSummary[] }>(
      "/api/agent/conversations"
    );

    setConversations(payload.conversations);
    setActiveConversationId((current) => {
      const target = preferredId || current;
      if (target && payload.conversations.some((item) => item.id === target)) {
        return target;
      }
      return null;
    });
  }

  async function createConversation() {
    setError(null);
    const payload = await fetchJson<{
      conversation: ConversationSummary;
    }>("/api/agent/conversations", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const created = payload.conversation;
    setConversations((prev) => [created, ...prev]);
    setActiveConversationId(created.id);
    setMessages([]);
    return created.id;
  }

  async function deleteConversation(conversationId: string) {
    const confirmed = window.confirm(
      "Supprimer cette conversation ? Les messages seront définitivement perdus."
    );
    if (!confirmed) return;

    setError(null);
    try {
      await fetchJson<{ ok: true }>(
        `/api/agent/conversations/${conversationId}`,
        { method: "DELETE" }
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer la conversation"
      );
      return;
    }

    setConversations((prev) => {
      const updated = prev.filter((conversation) => conversation.id !== conversationId);
      if (activeConversationId === conversationId) {
        setActiveConversationId(updated[0]?.id ?? null);
        setMessages([]);
      }
      return updated;
    });

    await reloadConversations(
      activeConversationId === conversationId ? undefined : activeConversationId ?? undefined
    );
  }

  function appendComposerFiles(files: File[]) {
    if (!files.length) return;

    setError(null);
    setComposerFiles((previous) => {
      const merged = [...previous, ...files];
      if (merged.length > MAX_ATTACHMENTS) {
        setError(`Maximum ${MAX_ATTACHMENTS} pièces jointes.`);
        return merged.slice(0, MAX_ATTACHMENTS);
      }
      return merged;
    });
  }

  function handleSelectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    appendComposerFiles(files);
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isDraggingFiles) {
      setIsDraggingFiles(true);
    }
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);

    const files = Array.from(event.dataTransfer.files || []);
    appendComposerFiles(files);
  }

  function removeComposerFile(indexToRemove: number) {
    setComposerFiles((previous) =>
      previous.filter((_, index) => index !== indexToRemove)
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if ((!value && composerFiles.length === 0) || isSending) return;

    const filesToSend = [...composerFiles];

    setError(null);
    setInput("");
    setComposerFiles([]);
    setIsSending(true);

    const tempUserMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: "USER",
      content: value,
      createdAt: new Date().toISOString(),
      attachments: filesToSend.map((file) => ({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        localUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })),
    };

    const pendingAssistantMessage: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: "ASSISTANT",
      content: "",
      createdAt: new Date().toISOString(),
      attachments: [],
      isPending: true,
    };

    setMessages((prev) => [...prev, tempUserMessage, pendingAssistantMessage]);

    try {
      const conversationId = activeConversationId || (await createConversation());

      const formData = new FormData();
      formData.append("message", value);
      for (const file of filesToSend) {
        formData.append("files", file);
      }

      const payload = await fetchJson<{
        userMessage: ChatMessage;
        message: ChatMessage;
        usedTools: string[];
      }>(`/api/agent/conversations/${conversationId}/messages`, {
        method: "POST",
        body: formData,
      });

      tempUserMessage.attachments.forEach((attachment) => {
        if (attachment.localUrl) {
          URL.revokeObjectURL(attachment.localUrl);
        }
      });

      setMessages((prev) => {
        const withoutTemp = prev.filter(
          (message) =>
            message.id !== tempUserMessage.id &&
            message.id !== pendingAssistantMessage.id
        );
        return [...withoutTemp, payload.userMessage, payload.message];
      });

      await reloadConversations(conversationId);
    } catch (sendError) {
      tempUserMessage.attachments.forEach((attachment) => {
        if (attachment.localUrl) {
          URL.revokeObjectURL(attachment.localUrl);
        }
      });

      const content =
        sendError instanceof Error
          ? sendError.message
          : "Le message n'a pas pu être envoyé.";

      setMessages((prev) => {
        const withoutTemp = prev.filter(
          (message) =>
            message.id !== tempUserMessage.id &&
            message.id !== pendingAssistantMessage.id
        );
        return [
          ...withoutTemp,
          {
            id: `temp-assistant-error-${Date.now()}`,
            role: "ASSISTANT",
            content,
            createdAt: new Date().toISOString(),
            attachments: [],
          },
        ];
      });
      setError(content);
    } finally {
      setIsSending(false);
    }
  }

  async function handleCreateConversation() {
    if (isSending) return;
    try {
      setError(null);
      await createConversation();
      await reloadConversations();
      setConversationSearch("");
      setIsMobileHistoryOpen(false);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Impossible de créer la conversation"
      );
    }
  }

  function handleSelectConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    setIsMobileHistoryOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-lg transition-colors hover:bg-slate-100 sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        title="Ouvrir l'agent IA"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="sr-only">Ouvrir l&apos;agent IA</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fermer le panneau"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/30"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-5xl border-l border-border bg-background shadow-2xl">
            <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[260px_1fr]">
              <div className="hidden flex-col border-r border-border md:flex">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">Conversations</p>
                    <p className="text-xs text-muted-foreground">Historique agent</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={handleCreateConversation}
                    title="Nouvelle conversation"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="border-b border-border px-3 py-2">
                  <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="search"
                      value={conversationSearch}
                      onChange={(event) => setConversationSearch(event.target.value)}
                      placeholder="Rechercher dans le texte"
                      className="w-full bg-transparent outline-none"
                    />
                  </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                  {isLoadingConversations ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Chargement...
                    </div>
                  ) : filteredConversations.length ? (
                    <ul className="space-y-1">
                      {filteredConversations.map((conversation) => {
                        const isActive = conversation.id === activeConversationId;
                        return (
                          <li key={conversation.id} className="group relative">
                            <button
                              type="button"
                              onClick={() => handleSelectConversation(conversation.id)}
                              className={`w-full rounded-lg px-3 py-2 pr-10 text-left transition-colors ${
                                isActive
                                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <p className="truncate text-sm font-medium">
                                {conversation.title}
                              </p>
                              <p
                                className={`truncate text-xs ${
                                  isActive
                                    ? "text-slate-200 dark:text-slate-700"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {conversation.preview || "Aucun message"}
                              </p>
                              <p
                                className={`mt-1 text-[10px] ${
                                  isActive
                                    ? "text-slate-300 dark:text-slate-700"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {formatTimestamp(conversation.updatedAt)}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteConversation(conversation.id);
                              }}
                              title="Supprimer la conversation"
                              className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition ${
                                isActive
                                  ? "opacity-100 hover:bg-white/10 hover:text-white dark:hover:bg-slate-200 dark:hover:text-slate-900"
                                  : "opacity-0 group-hover:opacity-100 hover:bg-slate-200/50 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="px-2 py-4 text-sm text-muted-foreground">
                      {normalizedSearch
                        ? "Aucune conversation ne correspond à la recherche."
                        : "Aucune conversation. Démarrez en envoyant un message."}
                    </p>
                  )}
                </div>
              </div>

              <div className="relative flex h-full min-h-0 flex-1 flex-col">
                {isMobileHistoryOpen ? (
                  <div className="absolute inset-0 z-10 flex flex-col bg-background md:hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold">Conversations</p>
                        <p className="text-xs text-muted-foreground">Historique agent</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsMobileHistoryOpen(false)}
                        title="Fermer l'historique"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="border-b border-border px-3 py-3">
                      <Button
                        type="button"
                        variant="add"
                        className="w-full justify-start"
                        onClick={handleCreateConversation}
                        title="Nouvelle conversation"
                      >
                        <Plus className="h-4 w-4" />
                        Nouvelle conversation
                      </Button>
                    </div>

                    <div className="border-b border-border px-3 py-3">
                      <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="search"
                          value={conversationSearch}
                          onChange={(event) => setConversationSearch(event.target.value)}
                          placeholder="Rechercher dans le texte"
                          className="w-full bg-transparent outline-none"
                        />
                      </label>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                      {isLoadingConversations ? (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Chargement...
                        </div>
                      ) : filteredConversations.length ? (
                        <ul className="space-y-1">
                          {filteredConversations.map((conversation) => {
                            const isActive = conversation.id === activeConversationId;
                            return (
                              <li key={conversation.id} className="group relative">
                                <button
                                  type="button"
                                  onClick={() => handleSelectConversation(conversation.id)}
                                  className={`w-full rounded-lg px-3 py-2 pr-10 text-left transition-colors ${
                                    isActive
                                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <p className="truncate text-sm font-medium">
                                    {conversation.title}
                                  </p>
                                  <p
                                    className={`truncate text-xs ${
                                      isActive
                                        ? "text-slate-200 dark:text-slate-700"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {conversation.preview || "Aucun message"}
                                  </p>
                                  <p
                                    className={`mt-1 text-[10px] ${
                                      isActive
                                        ? "text-slate-300 dark:text-slate-700"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {formatTimestamp(conversation.updatedAt)}
                                  </p>
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void deleteConversation(conversation.id);
                                  }}
                                  title="Supprimer la conversation"
                                  className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition ${
                                    isActive
                                      ? "opacity-100 hover:bg-white/10 hover:text-white dark:hover:bg-slate-200 dark:hover:text-slate-900"
                                      : "opacity-100 hover:bg-slate-200/50 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                  }`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="px-2 py-4 text-sm text-muted-foreground">
                          {normalizedSearch
                            ? "Aucune conversation ne correspond à la recherche."
                            : "Aucune conversation. Démarrez en envoyant un message."}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {activeConversation?.title || "Agent Homanager"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Posez une question ou déléguez une action.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="md:hidden"
                    onClick={() => setIsMobileHistoryOpen(true)}
                    title="Afficher l'historique"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  {activeConversationId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void deleteConversation(activeConversationId)}
                      title="Supprimer la conversation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsOpen(false)}
                    title="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Chargement des messages...
                  </div>
                ) : messages.length ? (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const fromUser = message.role === "USER";
                      return (
                        <div
                          key={message.id}
                          className={`flex ${fromUser ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                              fromUser
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                : "border bg-card"
                            }`}
                          >
                            {!fromUser ? (
                              <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Bot className="h-3 w-3" /> Agent
                              </p>
                            ) : null}
                            {message.isPending ? (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                              </div>
                            ) : message.content ? (
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            ) : null}

                            {message.attachments.length ? (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((attachment, index) => {
                                  const key = attachment.id || `${attachment.name}-${index}`;
                                  const fileUrl = attachment.path || attachment.localUrl;

                                  if (isImageAttachment(attachment) && fileUrl) {
                                    return (
                                      <a
                                        key={key}
                                        href={attachment.path || undefined}
                                        target={attachment.path ? "_blank" : undefined}
                                        rel={attachment.path ? "noreferrer" : undefined}
                                        className="block overflow-hidden rounded-lg border bg-black/5"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={fileUrl}
                                          alt={attachment.name}
                                          className="max-h-52 w-full object-cover"
                                        />
                                      </a>
                                    );
                                  }

                                  return (
                                    <a
                                      key={key}
                                      href={attachment.path || undefined}
                                      target={attachment.path ? "_blank" : undefined}
                                      rel={attachment.path ? "noreferrer" : undefined}
                                      className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs hover:bg-black/5"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                      <span className="truncate">{attachment.name}</span>
                                      <span className="text-[10px] opacity-70">
                                        {formatFileSize(attachment.sizeBytes)}
                                      </span>
                                    </a>
                                  );
                                })}
                              </div>
                            ) : null}

                            <p
                              className={`mt-1 text-[10px] ${
                                fromUser
                                  ? "text-slate-200 dark:text-slate-600"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatTimestamp(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      Commencez une conversation avec l&apos;agent.
                    </p>
                  </div>
                )}
              </div>

              <div
                className={`relative border-t border-border px-4 py-3 transition-colors ${
                  isDraggingFiles ? "bg-slate-100/80 dark:bg-slate-900/70" : ""
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDraggingFiles ? (
                  <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-400 bg-slate-50/90 text-sm text-slate-700 dark:border-slate-500 dark:bg-slate-900/85 dark:text-slate-200">
                    Dépose tes fichiers ici (images ou PDF)
                  </div>
                ) : null}
                <form onSubmit={handleSubmit} className="space-y-2">
                  {composerFiles.length ? (
                    <div className="flex flex-wrap gap-2">
                      {composerFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                        >
                          <span className="max-w-[220px] truncate">{file.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatFileSize(file.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeComposerFile(index)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Retirer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={handleSelectFiles}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                      title="Ajouter des pièces jointes"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>

                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          if (canSend && !isSending) {
                            event.currentTarget.form?.requestSubmit();
                          }
                        }
                      }}
                      placeholder="Ex: Quelles sont mes tâches aujourd'hui ?"
                      className="max-h-44 min-h-[42px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      rows={1}
                    />

                    <Button
                      type="submit"
                      variant="add"
                      size="icon"
                      className="rounded-full"
                      disabled={isSending || !canSend}
                      title="Envoyer"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </form>
                {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
              </div>
            </div>
          </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
