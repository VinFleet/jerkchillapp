"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Minus, Plus, Flag, CheckCircle2, Pencil } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { Bi } from "@/components/Bi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BigCheckbox } from "@/components/ui/BigCheckbox";
import { useSession } from "@/lib/auth/RoleContext";
import { canFlagRecipes, canEditRecipes, canSeeCostMargin } from "@/lib/auth/permissions";
import { getRecipe, getOpenFlagsForRecipe, raiseFlag, resolveFlag, saveRecipe } from "@/lib/repo/recipes";
import { getSettings } from "@/lib/repo/settings";
import { CATEGORY_LABEL } from "@/lib/recipeLabels";
import { scaleQty, formatQty } from "@/lib/scale";
import type { Recipe, RecipeFlag, Ingredient } from "@/lib/types";

function RecipeDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { session } = useSession();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [portions, setPortions] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<RecipeFlag[]>([]);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [flagSent, setFlagSent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftBase, setDraftBase] = useState("");
  const [draftIngredients, setDraftIngredients] = useState<Ingredient[]>([]);
  const [draftNoteEn, setDraftNoteEn] = useState("");
  const [draftNoteVi, setDraftNoteVi] = useState("");

  useEffect(() => {
    const r = getRecipe(id);
    setRecipe(r ?? null);
    if (r) setPortions(r.basePortions);
    setFlags(getOpenFlagsForRecipe(id));
  }, [id]);

  if (recipe === undefined) return null;
  if (recipe === null || !session) {
    return (
      <div className="p-6 text-center text-muted">
        Recipe not found · Không tìm thấy công thức
      </div>
    );
  }

  const adjustPortions = (delta: number) => setPortions((p) => Math.max(1, p + delta));

  const toggleStep = (stepId: string) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const submitFlag = () => {
    if (!flagNote.trim()) return;
    raiseFlag(recipe.id, session.name, session.role, flagNote.trim());
    setFlags(getOpenFlagsForRecipe(recipe.id));
    setFlagNote("");
    setFlagOpen(false);
    setFlagSent(true);
    setTimeout(() => setFlagSent(false), 3000);
  };

  const doResolveFlag = (flagId: string) => {
    resolveFlag(flagId);
    setFlags(getOpenFlagsForRecipe(recipe.id));
  };

  const startEditing = () => {
    setDraftBase(String(recipe.basePortions));
    setDraftIngredients(recipe.ingredients.map((i) => ({ ...i })));
    setDraftNoteEn(recipe.notes?.en ?? "");
    setDraftNoteVi(recipe.notes?.vi ?? "");
    setEditing(true);
  };

  const updateDraftQty = (index: number, value: string) => {
    setDraftIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, qty: Number(value) || 0 } : ing)));
  };

  /** Closes the loop a chef's flag opens — without this, a flag could be raised and marked resolved but the recipe never actually changed. */
  const saveEdits = () => {
    const base = Number(draftBase) || recipe.basePortions;
    const updated: Recipe = {
      ...recipe,
      basePortions: Math.max(1, base),
      ingredients: draftIngredients,
      notes: draftNoteEn.trim() || draftNoteVi.trim() ? { en: draftNoteEn.trim(), vi: draftNoteVi.trim() } : undefined,
      updatedAt: new Date().toISOString(),
    };
    saveRecipe(updated);
    setRecipe(updated);
    setPortions(updated.basePortions);
    setEditing(false);
  };

  return (
    <div className="pb-10">
      <div className="px-4 md:px-8 pt-4 flex items-center gap-2">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-brand">
          <ChevronLeft size={24} />
        </button>
        <span className="text-sm text-muted">
          {CATEGORY_LABEL[recipe.category].en} · {CATEGORY_LABEL[recipe.category].vi}
        </span>
      </div>

      <div className="px-4 md:px-8 mt-1">
        <Bi value={recipe.name} className="text-2xl font-bold" viClassName="text-lg font-normal text-muted" />
      </div>

      {flagSent && (
        <div className="mx-4 md:mx-8 mt-3 bg-success-tint text-success rounded-xl p-3 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={18} /> Manager notified · Đã báo cho quản lý
        </div>
      )}

      {canEditRecipes(session.role) && flags.length > 0 && (
        <div className="mx-4 md:mx-8 mt-3 space-y-2">
          {flags.map((f) => (
            <div key={f.id} className="bg-warning-tint border border-warning/30 rounded-xl p-3">
              <p className="text-sm font-semibold text-warning">
                Flagged by {f.raisedBy} · Được đánh dấu bởi {f.raisedBy}
              </p>
              <p className="text-sm mt-1">{f.note}</p>
              <button
                onClick={() => doResolveFlag(f.id)}
                className="text-xs font-semibold text-brand mt-2"
              >
                Mark resolved · Đánh dấu đã xử lý
              </button>
            </div>
          ))}
        </div>
      )}

      {recipe.notes && (
        <div className="mx-4 md:mx-8 mt-3 bg-brand-light rounded-xl p-3 text-sm">
          <Bi value={recipe.notes} className="text-brand" />
        </div>
      )}

      {/* Portion scaler */}
      <Card className="mx-4 md:mx-8 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Scale to portions</p>
            <p className="text-muted text-xs">Nhân theo khẩu phần</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustPortions(-1)}
              className="w-12 h-12 rounded-xl bg-brand-light text-brand flex items-center justify-center active:bg-brand-tint"
              aria-label="Decrease portions"
            >
              <Minus size={20} />
            </button>
            <span className="w-12 text-center text-xl font-bold tabular-nums">{portions}</span>
            <button
              onClick={() => adjustPortions(1)}
              className="w-12 h-12 rounded-xl bg-brand-light text-brand flex items-center justify-center active:bg-brand-tint"
              aria-label="Increase portions"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
        {/* Jumping from a 12-portion base to a 96-portion event was 84 taps.
            These are the batch sizes the real recipe book scales to. */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          {[1, 2, 4, 8].map((mult) => {
            const target = recipe.basePortions * mult;
            return (
              <button
                key={mult}
                onClick={() => setPortions(target)}
                className={`flex-1 min-h-11 rounded-xl text-sm font-semibold border-2 tabular-nums ${
                  portions === target ? "bg-brand text-white border-brand" : "border-border text-muted"
                }`}
              >
                {target}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Ingredients */}
      <div className="px-4 md:px-8 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm text-muted uppercase tracking-wide">
            Ingredients · Nguyên liệu
          </h2>
          {canEditRecipes(session.role) && !editing && (
            <button onClick={startEditing} className="flex items-center gap-1 text-xs text-brand font-semibold">
              <Pencil size={12} /> Edit recipe · Sửa công thức
            </button>
          )}
        </div>

        {editing ? (
          <Card className="space-y-3">
            <div>
              <label className="text-xs text-muted">Base portions · Khẩu phần gốc</label>
              <input
                type="number"
                inputMode="numeric"
                value={draftBase}
                onChange={(e) => setDraftBase(e.target.value)}
                className="w-full min-h-12 rounded-xl border-2 border-border px-3 mt-1 text-sm focus:outline-none focus:border-brand"
              />
            </div>
            <div className="space-y-2">
              {draftIngredients.map((ing, i) => (
                <div key={ing.id} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{ing.name.en}</span>
                    <span className="block text-xs text-muted truncate">{ing.name.vi}</span>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ing.qty}
                    onChange={(e) => updateDraftQty(i, e.target.value)}
                    className="w-24 min-h-11 rounded-xl border-2 border-border px-2 text-sm text-center focus:outline-none focus:border-brand"
                    aria-label={`Quantity for ${ing.name.en}`}
                  />
                  <span className="text-xs text-muted w-24 shrink-0">{ing.unit}</span>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted">Notes · Ghi chú</label>
              <textarea
                value={draftNoteEn}
                onChange={(e) => setDraftNoteEn(e.target.value)}
                rows={2}
                placeholder="Notes (English)"
                className="w-full rounded-xl border-2 border-border px-3 py-2 mt-1 text-sm focus:outline-none focus:border-brand"
              />
              <textarea
                value={draftNoteVi}
                onChange={(e) => setDraftNoteVi(e.target.value)}
                rows={2}
                placeholder="Ghi chú (Tiếng Việt)"
                className="w-full rounded-xl border-2 border-border px-3 py-2 mt-2 text-sm focus:outline-none focus:border-brand"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 min-h-11 text-sm" onClick={() => setEditing(false)}>
                Cancel · Hủy
              </Button>
              <Button className="flex-1 min-h-11 text-sm" onClick={saveEdits}>
                Save · Lưu
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="divide-y divide-border p-0">
            {recipe.ingredients.map((ing) => (
              <div key={ing.id} className="flex items-center justify-between px-4 py-3">
                <Bi value={ing.name} className="text-sm" mode="inline" />
                <span className="font-semibold tabular-nums text-sm shrink-0 ml-3">
                  {formatQty(scaleQty(ing.qty, recipe.basePortions, portions))} {ing.unit}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Method as checklist */}
      <div className="px-4 md:px-8 mt-5">
        <h2 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">
          Method · Cách làm
        </h2>
        <div className="space-y-2">
          {recipe.steps.map((step, i) => (
            <BigCheckbox
              key={step.id}
              label={{ en: `${i + 1}. ${step.text.en}`, vi: `${i + 1}. ${step.text.vi}` }}
              checked={checkedSteps.has(step.id)}
              onToggle={() => toggleStep(step.id)}
            />
          ))}
        </div>
      </div>

      {typeof recipe.costPerPortionVnd === "number" && canSeeCostMargin(session.role, getSettings()) && (
        <div className="px-4 md:px-8 mt-5">
          <Card>
            <p className="text-sm text-muted">Cost per portion · Chi phí mỗi khẩu phần</p>
            <p className="text-lg font-bold text-brand">
              {recipe.costPerPortionVnd.toLocaleString("vi-VN")}₫
            </p>
          </Card>
        </div>
      )}

      {/* Flag for review */}
      {canFlagRecipes(session.role) && (
        <div className="px-4 md:px-8 mt-6">
          {!flagOpen ? (
            <Button variant="secondary" className="w-full" onClick={() => setFlagOpen(true)}>
              <Flag size={18} /> This needs updating · Cần cập nhật
            </Button>
          ) : (
            <Card>
              <p className="font-semibold text-sm mb-2">What needs to change? · Cần thay đổi gì?</p>
              <textarea
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                rows={3}
                className="w-full rounded-xl border-2 border-border p-3 text-sm focus:outline-none focus:border-brand"
                placeholder="e.g. Scotch Bonnet quantity feels too spicy now"
              />
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" className="flex-1" onClick={() => setFlagOpen(false)}>
                  Cancel · Hủy
                </Button>
                <Button className="flex-1" onClick={submitFlag} disabled={!flagNote.trim()}>
                  Send to manager
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  return (
    <RoleGate module="recipes">
      <RecipeDetailContent id={id} />
    </RoleGate>
  );
}
