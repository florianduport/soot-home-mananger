import type { MetadataRoute } from "next";
import { getServerLanguage } from "@/lib/i18n/server";
import { translateText } from "@/lib/i18n/translate";

const APP_DESCRIPTION = "Gestion des tâches et de la maison";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const language = await getServerLanguage();

  return {
    name: "Soot",
    short_name: "Soot",
    description: translateText(APP_DESCRIPTION, language),
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111827",
    lang: language,
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
