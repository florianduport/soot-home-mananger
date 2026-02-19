import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importMarketplaceTemplate } from "@/app/actions";
import {
  getMarketplaceCategories,
  marketplaceTemplates,
} from "@/lib/marketplace-templates";
import { getHouseData, requireSession } from "@/lib/house";
import { Sparkles, Star } from "lucide-react";

type MarketplaceSearchParams = { [key: string]: string | string[] | undefined };

function resolveSearchParams(
  searchParams: MarketplaceSearchParams | Promise<MarketplaceSearchParams>
) {
  return typeof (searchParams as Promise<MarketplaceSearchParams>)?.then === "function"
    ? (searchParams as Promise<MarketplaceSearchParams>)
    : Promise.resolve(searchParams as MarketplaceSearchParams);
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: MarketplaceSearchParams | Promise<MarketplaceSearchParams>;
}) {
  const session = await requireSession();
  const { houseId } = await getHouseData(session.user.id);
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const queryValue = (resolvedSearchParams.q ?? "").toString();
  const categoryFilter = (resolvedSearchParams.category ?? "").toString();
  const query = queryValue.trim().toLowerCase();

  const categories = getMarketplaceCategories();
  const filteredTemplates = marketplaceTemplates.filter((template) => {
    if (categoryFilter && template.category !== categoryFilter) return false;
    if (!query) return true;
    const haystack = `${template.title} ${template.description} ${template.category}`.toLowerCase();
    return haystack.includes(query);
  });

  return (
    <section className="space-y-6">
      <header className="page-header flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Sparkles className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Marketplace</p>
          <h1 className="text-2xl font-semibold">Modèles de tâches</h1>
        </div>
        <form className="flex w-full max-w-sm items-center gap-2 sm:w-auto">
          <Input
            name="q"
            placeholder="Rechercher un modèle"
            defaultValue={queryValue}
          />
          <Button type="submit" variant="outline">
            Filtrer
          </Button>
        </form>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/app/marketplace"
          className={`rounded-full border px-3 py-1 transition-colors ${
            categoryFilter
              ? "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              : "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
          }`}
        >
          Tous
        </Link>
        {categories.map((category) => (
          <Link
            key={category}
            href={`/app/marketplace?category=${encodeURIComponent(category)}`}
            className={`rounded-full border px-3 py-1 transition-colors ${
              categoryFilter === category
                ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {category}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredTemplates.length ? (
          filteredTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline">{template.category}</Badge>
                  <Badge
                    variant={template.cadence === "Récurrent" ? "default" : "secondary"}
                  >
                    {template.cadence}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{template.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="h-4 w-4 fill-current text-[color:var(--accent-amber)]" />
                    <span className="font-medium text-foreground">
                      {template.rating.toFixed(1)}
                    </span>
                    <span>({template.reviewCount} avis)</span>
                  </div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {template.source}
                  </span>
                </div>

                <form action={importMarketplaceTemplate} className="flex flex-wrap gap-2">
                  <input type="hidden" name="houseId" value={houseId} />
                  <input type="hidden" name="templateId" value={template.id} />
                  <Button type="submit" className="w-full sm:w-auto">
                    Importer dans mes tâches
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucun modèle ne correspond à votre recherche.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
