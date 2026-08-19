"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Flag } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { getRecipes } from "@/lib/repo/recipes";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/recipeLabels";
import type { Recipe, RecipeCategory } from "@/lib/types";
import { getFlags } from "@/lib/repo/recipes";

function RecipesPageContent() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecipeCategory | "all">("all");
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRecipes(getRecipes());
    setFlaggedIds(new Set(getFlags().filter((f) => !f.resolved).map((f) => f.recipeId)));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesQuery =
        !q || r.name.en.toLowerCase().includes(q) || r.name.vi.toLowerCase().includes(q);
      const matchesCategory = category === "all" || r.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [recipes, query, category]);

  const grouped = useMemo(() => {
    const map = new Map<RecipeCategory, Recipe[]>();
    for (const r of filtered) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, [filtered]);

  return (
    <div>
      <PageHeader title="Recipe Book · Sổ Công Thức" subtitle="Tap a dish to view and scale · Chạm để xem và nhân khẩu phần" />

      <div className="px-4 md:px-8 space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipe · Tìm công thức"
            className="w-full min-h-14 rounded-2xl border-2 border-border pl-11 pr-4 text-base focus:outline-none focus:border-brand bg-surface"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          <button
            onClick={() => setCategory("all")}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 ${
              category === "all" ? "bg-brand text-white border-brand" : "border-border text-foreground"
            }`}
          >
            All · Tất cả
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 whitespace-nowrap ${
                category === c ? "bg-brand text-white border-brand" : "border-border text-foreground"
              }`}
            >
              {CATEGORY_LABEL[c].en} · {CATEGORY_LABEL[c].vi}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-8 mt-4 space-y-6 pb-6">
        {grouped.length === 0 && (
          <p className="text-muted text-center py-10">No recipes found · Không tìm thấy công thức</p>
        )}
        {grouped.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">
              {CATEGORY_LABEL[cat].en} · {CATEGORY_LABEL[cat].vi}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((r) => (
                <Link
                  key={r.id}
                  href={`/recipes/${r.id}`}
                  className="min-h-20 bg-surface border border-border rounded-2xl p-4 flex items-center justify-between gap-2 active:bg-brand-light transition-colors"
                >
                  <Bi value={r.name} className="font-semibold" />
                  {flaggedIds.has(r.id) && <Flag size={18} className="text-warning shrink-0" />}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function RecipesPage() {
  return (
    <RoleGate module="recipes">
      <RecipesPageContent />
    </RoleGate>
  );
}
