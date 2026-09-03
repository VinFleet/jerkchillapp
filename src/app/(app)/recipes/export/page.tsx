"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, ShieldAlert } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { TenantBrandmark } from "@/components/TenantBrandmark";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditRecipes, canSeeCostMargin } from "@/lib/auth/permissions";
import { getRecipes } from "@/lib/repo/recipes";
import { getSettings } from "@/lib/repo/settings";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/recipeLabels";
import { scaleQty, formatQty } from "@/lib/scale";
import type { Recipe, RecipeCategory } from "@/lib/types";

/**
 * The recipe book, formatted to actually hand someone.
 *
 * Same trick as the food-safety export: a page styled for print, and the
 * browser's own "print to PDF" does the rest — no PDF library, no server
 * render, and it works offline exactly as well as any other screen here.
 * `print:hidden` strips the controls; what's left is the document.
 */

const SCALE_OPTIONS = [1, 2, 4] as const;

function RecipePrintCard({ recipe, scaleFactor, showCost }: { recipe: Recipe; scaleFactor: number; showCost: boolean }) {
  const portions = recipe.basePortions * scaleFactor;
  return (
    <section className="break-inside-avoid mb-8 pb-8 border-b border-border last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold">
          {recipe.name.en}
          {recipe.name.vi && <span className="text-base font-normal text-muted"> · {recipe.name.vi}</span>}
        </h2>
        <span className="text-sm text-muted shrink-0 tabular-nums">{portions} portions · khẩu phần</span>
      </div>
      <p className="text-xs text-muted uppercase tracking-wide mt-0.5">
        {CATEGORY_LABEL[recipe.category].en} · {CATEGORY_LABEL[recipe.category].vi}
      </p>

      <div className="grid sm:grid-cols-[1fr_1.4fr] gap-6 mt-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1.5">Ingredients · Nguyên liệu</p>
          <ul className="text-sm space-y-1">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex justify-between gap-3">
                <span>
                  {ing.name.en}
                  {ing.name.vi && <span className="text-muted"> · {ing.name.vi}</span>}
                </span>
                <span className="tabular-nums font-semibold shrink-0">
                  {formatQty(scaleQty(ing.qty, recipe.basePortions, portions))} {ing.unit}
                </span>
              </li>
            ))}
          </ul>
          {showCost && typeof recipe.costPerPortionVnd === "number" && (
            <p className="text-xs text-muted mt-2">
              Cost/portion: {recipe.costPerPortionVnd.toLocaleString("vi-VN")}₫
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1.5">Method · Cách làm</p>
          {recipe.steps.length > 0 ? (
            <ol className="text-sm space-y-1.5 list-decimal list-inside">
              {recipe.steps.map((step) => (
                <li key={step.id}>
                  {step.text.en}
                  {step.text.vi && <span className="text-muted"> · {step.text.vi}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted italic">No method written up yet · Chưa viết cách làm</p>
          )}
        </div>
      </div>
      {recipe.notes && (recipe.notes.en || recipe.notes.vi) && (
        <p className="text-xs bg-brand-light text-brand rounded-lg px-3 py-1.5 mt-3 print:bg-white print:text-foreground print:border print:border-border">
          {recipe.notes.en}
          {recipe.notes.vi && ` · ${recipe.notes.vi}`}
        </p>
      )}
    </section>
  );
}

function ExportContent() {
  const { session } = useSession();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [category, setCategory] = useState<RecipeCategory | "all">("all");
  const [scaleFactor, setScaleFactor] = useState<number>(1);

  useEffect(() => {
    setRecipes(getRecipes());
  }, []);

  const grouped = useMemo(() => {
    const filtered = category === "all" ? recipes : recipes.filter((r) => r.category === category);
    const map = new Map<RecipeCategory, Recipe[]>();
    for (const r of filtered) map.set(r.category, [...(map.get(r.category) ?? []), r]);
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, [recipes, category]);

  if (!session) return null;
  if (!canEditRecipes(session.role)) {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Not available for your role</p>
        <p className="text-muted text-sm">Không khả dụng cho vai trò của bạn</p>
      </div>
    );
  }
  const showCost = canSeeCostMargin(session.role, getSettings());

  return (
    <div className="pb-10">
      <div className="print:hidden">
        <BackLink href="/recipes" label="Recipe Book · Sổ Công Thức" />
        <PageHeader title="Print the recipe book · In sổ công thức" subtitle="Print or save as PDF · In hoặc lưu PDF" />
      </div>

      <div className="px-4 md:px-8 print:hidden space-y-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory("all")}
            className={`min-h-11 px-4 rounded-full font-semibold text-sm border-2 shrink-0 ${
              category === "all" ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            All · Tất cả
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`min-h-11 px-4 rounded-full font-semibold text-sm border-2 shrink-0 ${
                category === c ? "bg-brand text-white border-brand" : "border-border text-muted"
              }`}
            >
              {CATEGORY_LABEL[c].en} · {CATEGORY_LABEL[c].vi}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {SCALE_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setScaleFactor(m)}
              className={`flex-1 min-h-11 rounded-xl font-semibold text-sm border-2 ${
                scaleFactor === m ? "bg-brand-light text-brand border-brand" : "border-border text-muted"
              }`}
            >
              {m === 1 ? "Base portions · Khẩu phần gốc" : `×${m}`}
            </button>
          ))}
        </div>
        <Button className="w-full" onClick={() => window.print()} disabled={recipes.length === 0}>
          <Printer size={18} /> Print / Save as PDF · In / Lưu PDF
        </Button>
      </div>

      <div className="px-4 md:px-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-foreground">
          <TenantBrandmark />
        </div>

        {recipes.length === 0 ? (
          <p className="text-muted text-center py-10">
            No recipes yet — add some first · Chưa có công thức nào
          </p>
        ) : (
          grouped.map(([cat, items]) => (
            <div key={cat} className="mb-8 break-before-page first:break-before-auto">
              <h1 className="text-2xl font-bold border-b-2 border-foreground pb-2 mb-4">
                {CATEGORY_LABEL[cat].en} <span className="text-muted font-normal">· {CATEGORY_LABEL[cat].vi}</span>
              </h1>
              {items.map((r) => (
                <RecipePrintCard key={r.id} recipe={r} scaleFactor={scaleFactor} showCost={showCost} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function RecipeExportPage() {
  return (
    <RoleGate module="recipes">
      <ExportContent />
    </RoleGate>
  );
}
