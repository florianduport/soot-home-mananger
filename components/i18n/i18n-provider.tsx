"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_LANGUAGE,
  detectLanguageFromNavigator,
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_COOKIE_MAX_AGE_SECONDS,
  LANGUAGE_STORAGE_KEY,
  localeTagFromLanguage,
  normalizeLanguage,
  resolveLanguage,
  type AppLanguage,
} from "@/lib/i18n/language";
import { translateText } from "@/lib/i18n/translate";

type I18nContextValue = {
  language: AppLanguage;
  localeTag: string;
  setLanguage: (language: AppLanguage) => void;
  isAutoDetected: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIPPED_TEXT_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);

function extractLanguageFromCookie(cookieString: string) {
  const chunks = cookieString.split(";").map((chunk) => chunk.trim());
  const languageCookie = chunks.find((chunk) => chunk.startsWith(`${LANGUAGE_COOKIE_KEY}=`));
  if (!languageCookie) return null;
  const rawValue = languageCookie.slice(LANGUAGE_COOKIE_KEY.length + 1);
  return normalizeLanguage(decodeURIComponent(rawValue));
}

function persistLanguage(language: AppLanguage) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures in private mode.
  }

  document.cookie = `${LANGUAGE_COOKIE_KEY}=${encodeURIComponent(language)}; Max-Age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

function isElementIgnored(element: Element | null) {
  if (!element) return true;
  if (element.closest('[data-i18n-ignore="true"]')) return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return false;
}

export function I18nProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  children: React.ReactNode;
  initialLanguage?: AppLanguage;
}) {
  const initialResolvedLanguage = resolveLanguage(initialLanguage);
  const [language, setLanguageState] = useState<AppLanguage>(initialResolvedLanguage);
  const [isAutoDetected, setIsAutoDetected] = useState(false);

  const textSourceMapRef = useRef<WeakMap<Text, string>>(new WeakMap());
  const attributeSourceMapRef = useRef<WeakMap<Element, Map<string, string>>>(new WeakMap());
  const previousLanguageRef = useRef<AppLanguage>(initialResolvedLanguage);

  const processTextNode = useCallback(
    (node: Text, targetLanguage: AppLanguage, previousLanguage: AppLanguage) => {
      const parentElement = node.parentElement;
      if (!parentElement) return;
      if (SKIPPED_TEXT_TAGS.has(parentElement.tagName)) return;
      if (isElementIgnored(parentElement)) return;

      const currentValue = node.nodeValue ?? "";
      if (!currentValue.trim()) return;

      const sourceMap = textSourceMapRef.current;
      const existingSource = sourceMap.get(node);
      let source = existingSource;

      if (!source) {
        source = currentValue;
        sourceMap.set(node, source);
      } else {
        const translatedCurrent = translateText(source, targetLanguage);
        const translatedPrevious = translateText(source, previousLanguage);

        if (
          currentValue !== translatedCurrent &&
          currentValue !== translatedPrevious &&
          currentValue !== source
        ) {
          source = currentValue;
          sourceMap.set(node, source);
        }
      }

      const nextValue = translateText(source, targetLanguage);
      if (currentValue !== nextValue) {
        node.nodeValue = nextValue;
      }
    },
    []
  );

  const processElementAttributes = useCallback(
    (element: Element, targetLanguage: AppLanguage, previousLanguage: AppLanguage) => {
      if (isElementIgnored(element)) return;

      const attributeMapStore = attributeSourceMapRef.current;
      let sourceAttributes = attributeMapStore.get(element);
      if (!sourceAttributes) {
        sourceAttributes = new Map();
        attributeMapStore.set(element, sourceAttributes);
      }

      for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
        const attributeValue = element.getAttribute(attributeName);
        if (!attributeValue || !attributeValue.trim()) continue;

        const existingSource = sourceAttributes.get(attributeName);
        let source = existingSource;

        if (!source) {
          source = attributeValue;
          sourceAttributes.set(attributeName, source);
        } else {
          const translatedCurrent = translateText(source, targetLanguage);
          const translatedPrevious = translateText(source, previousLanguage);

          if (
            attributeValue !== translatedCurrent &&
            attributeValue !== translatedPrevious &&
            attributeValue !== source
          ) {
            source = attributeValue;
            sourceAttributes.set(attributeName, source);
          }
        }

        const nextValue = translateText(source, targetLanguage);
        if (attributeValue !== nextValue) {
          element.setAttribute(attributeName, nextValue);
        }
      }
    },
    []
  );

  const translateSubtree = useCallback(
    (root: Node, targetLanguage: AppLanguage, previousLanguage: AppLanguage) => {
      if (root.nodeType === Node.TEXT_NODE) {
        processTextNode(root as Text, targetLanguage, previousLanguage);
        return;
      }

      if (root.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      processElementAttributes(root as Element, targetLanguage, previousLanguage);

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
      );

      while (walker.nextNode()) {
        const currentNode = walker.currentNode;
        if (currentNode.nodeType === Node.TEXT_NODE) {
          processTextNode(currentNode as Text, targetLanguage, previousLanguage);
          continue;
        }

        if (currentNode.nodeType === Node.ELEMENT_NODE) {
          processElementAttributes(currentNode as Element, targetLanguage, previousLanguage);
        }
      }
    },
    [processElementAttributes, processTextNode]
  );

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem(LANGUAGE_STORAGE_KEY);
      } catch {
        return null;
      }
    })();

    const cookieLanguage = extractLanguageFromCookie(document.cookie);
    const nextLanguage = stored
      ? resolveLanguage(stored)
      : cookieLanguage ??
        detectLanguageFromNavigator(navigator.languages, navigator.language);
    const nextIsAutoDetected = !stored && !cookieLanguage;
    persistLanguage(nextLanguage);

    const frameId = window.requestAnimationFrame(() => {
      setLanguageState((current) => (current === nextLanguage ? current : nextLanguage));
      setIsAutoDetected(nextIsAutoDetected);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    persistLanguage(language);

    const previousLanguage = previousLanguageRef.current;
    if (document.body) {
      translateSubtree(document.body, language, previousLanguage);
    }

    previousLanguageRef.current = language;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          processTextNode(mutation.target as Text, language, previousLanguageRef.current);
          continue;
        }

        if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
          processElementAttributes(
            mutation.target as Element,
            language,
            previousLanguageRef.current
          );
          continue;
        }

        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            translateSubtree(node, language, previousLanguageRef.current);
          });
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, [language, processElementAttributes, processTextNode, translateSubtree]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(resolveLanguage(nextLanguage));
    setIsAutoDetected(false);
  }, []);

  const value = useMemo(
    () => ({
      language,
      localeTag: localeTagFromLanguage(language),
      setLanguage,
      isAutoDetected,
    }),
    [isAutoDetected, language, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
}
