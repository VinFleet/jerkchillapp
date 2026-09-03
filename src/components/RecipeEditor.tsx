"use client";

import { useState } from "react";
import { Plus, Trash2, AlertTriangle, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/recipeLabels";
import { validateRecipeDraft } from "@/lib/repo/recipeRules";
import { newId } from "@/lib/storage";
import type { Recipe, Ingredient, MethodStep } from "@/lib/types";

/**
 * The whole recipe, from a blank page.
 *
 * One editor for both "start a new dish" and "fix an existing one" — a
 * restaurant's recipe book gets written the same way either time: name it,
 * list what goes in, say how much, write the method. Reordering is a single
 * up/down tap rather than drag-and-drop, which does not survive a thumb on a
 * wet-handed phone mid-shift.
 */

const REASON_LABEL: Record<string, { en: string; vi: string }> = {
  name: { en: "Give the dish a name (either language is fine)", vi: "Đặt tên món (một ngôn ngữ cũng được)" },
  portions: { en: "Base portions must be at least 1", vi: "Khẩu phần gốc phải từ 1 trở lên" },
  ingredients: { en: "Add at least one ingredient", vi: "Thêm ít nhất một nguyên liệu" },
  ingredient_incomplete: {
    en: "Every ingredient needs a name and a quantity above zero",
    vi: "Mỗi nguyên liệu cần tên và số lượng lớn hơn 0",
  },
};

function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function RecipeEditor({
  initial,
  onSave,
  onCancel,
  saveLabel = { en: "Save · Lưu", vi: "" },
}: {
  initial: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel?: () => void;
  saveLabel?: { en: string; vi: string };
}) {
  const [nameEn, setNameEn] = useState(initial.name.en);
  const [nameVi, setNameVi] = useState(initial.name.vi);
  const [category, setCategory] = useState(initial.category);
  const [basePortions, setBasePortions] = useState(String(initial.basePortions));
  const [ingredients, setIngredients] = useState<Ingredient[]>(initial.ingredients.map((i) => ({ ...i })));
  const [steps, setSteps] = useState<MethodStep[]>(initial.steps.map((s) => ({ ...s })));
  const [noteEn, setNoteEn] = useState(initial.notes?.en ?? "");
  const [noteVi, setNoteVi] = useState(initial.notes?.vi ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  const addIngredient = () =>
    setIngredients((prev) => [...prev, { id: newId("ing"), name: { en: "", vi: "" }, qty: 0, unit: "" }]);
  const updateIngredient = (i: number, patch: Partial<Ingredient>) =>
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));
  const removeIngredient = (i: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== i));

  const addStep = () => setSteps((prev) => [...prev, { id: newId("step"), text: { en: "", vi: "" } }]);
  const updateStep = (i: number, patch: Partial<MethodStep["text"]>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, text: { ...s.text, ...patch } } : s)));
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const save = () => {
    const portions = Math.max(1, Math.round(Number(basePortions) || 0));
    const verdict = validateRecipeDraft({ name: { en: nameEn, vi: nameVi }, basePortions: portions, ingredients });
    if (!verdict.ok) {
      const label = REASON_LABEL[verdict.reason];
      setProblem(`${label.en}${label.vi ? " · " + label.vi : ""}`);
      return;
    }
    onSave({
      ...initial,
      name: { en: nameEn.trim(), vi: nameVi.trim() },
      category,
      basePortions: portions,
      ingredients: ingredients.map((i) => ({ ...i, name: { en: i.name.en.trim(), vi: i.name.vi.trim() } })),
      steps: steps
        .filter((s) => s.text.en.trim() || s.text.vi.trim())
        .map((s) => ({ ...s, text: { en: s.text.en.trim(), vi: s.text.vi.trim() } })),
      notes: noteEn.trim() || noteVi.trim() ? { en: noteEn.trim(), vi: noteVi.trim() } : undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-muted">Name (English) · Tên (Tiếng Anh)</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Jerk Chicken"
              className="w-full min-h-[48px] rounded-xl border-2 border-border px-3 focus:outline-none focus:border-brand"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted">Name (Vietnamese) · Tên (Tiếng Việt)</span>
            <input
              value={nameVi}
              onChange={(e) => setNameVi(e.target.value)}
              placeholder="Gà Jerk"
              className="w-full min-h-[48px] rounded-xl border-2 border-border px-3 focus:outline-none focus:border-brand"
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-muted">Category · Danh mục</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Recipe["category"])}
              className="w-full min-h-[48px] rounded-xl border-2 border-border px-3 bg-surface focus:outline-none focus:border-brand"
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c].en} · {CATEGORY_LABEL[c].vi}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted">Base portions · Khẩu phần gốc</span>
            <input
              value={basePortions}
              onChange={(e) => setBasePortions(e.target.value)}
              inputMode="numeric"
              className="w-full min-h-[48px] rounded-xl border-2 border-border px-3 tabular-nums focus:outline-none focus:border-brand"
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="font-bold text-sm text-muted uppercase tracking-wide">Ingredients · Nguyên liệu</p>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={ing.id} className="rounded-xl border border-border p-2.5 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  value={ing.name.en}
                  onChange={(e) => updateIngredient(i, { name: { ...ing.name, en: e.target.value } })}
                  placeholder="Ingredient (English)"
                  className="w-full min-h-[44px] rounded-lg border border-border px-2.5 text-sm"
                />
                <input
                  value={ing.name.vi}
                  onChange={(e) => updateIngredient(i, { name: { ...ing.name, vi: e.target.value } })}
                  placeholder="Nguyên liệu (Tiếng Việt)"
                  className="w-full min-h-[44px] rounded-lg border border-border px-2.5 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={ing.qty || ""}
                  onChange={(e) => updateIngredient(i, { qty: Number(e.target.value) || 0 })}
                  inputMode="decimal"
                  placeholder="Qty"
                  className="w-24 min-h-[44px] rounded-lg border border-border px-2.5 text-sm text-center tabular-nums"
                />
                <input
                  value={ing.unit}
                  onChange={(e) => updateIngredient(i, { unit: e.target.value })}
                  placeholder="Unit · Đơn vị (g, kg, ml…)"
                  className="flex-1 min-h-[44px] rounded-lg border border-border px-2.5 text-sm"
                />
                <button
                  onClick={() => removeIngredient(i)}
                  aria-label="Remove ingredient"
                  className="w-11 h-11 shrink-0 rounded-lg grid place-items-center text-muted"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addIngredient}
          className="w-full min-h-[48px] rounded-xl border-2 border-dashed border-brand text-brand text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add ingredient · Thêm nguyên liệu
        </button>
      </Card>

      <Card className="space-y-3">
        <p className="font-bold text-sm text-muted uppercase tracking-wide">Method · Cách làm</p>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={step.id} className="rounded-xl border border-border p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 shrink-0 rounded-full bg-brand-light text-brand text-xs font-bold grid place-items-center">
                  {i + 1}
                </span>
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => setSteps((prev) => move(prev, i, -1))}
                    disabled={i === 0}
                    aria-label="Move step up"
                    className="text-muted disabled:opacity-30"
                  >
                    <GripVertical size={14} className="rotate-90" />
                  </button>
                </div>
                <button
                  onClick={() => removeStep(i)}
                  aria-label="Remove step"
                  className="ml-auto w-9 h-9 shrink-0 rounded-lg grid place-items-center text-muted"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <textarea
                value={step.text.en}
                onChange={(e) => updateStep(i, { en: e.target.value })}
                placeholder="Step in English"
                rows={2}
                className="w-full rounded-lg border border-border px-2.5 py-2 text-sm"
              />
              <textarea
                value={step.text.vi}
                onChange={(e) => updateStep(i, { vi: e.target.value })}
                placeholder="Bước bằng Tiếng Việt"
                rows={2}
                className="w-full rounded-lg border border-border px-2.5 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <button
          onClick={addStep}
          className="w-full min-h-[48px] rounded-xl border-2 border-dashed border-brand text-brand text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add step · Thêm bước
        </button>
      </Card>

      <Card className="space-y-2">
        <p className="font-bold text-sm text-muted uppercase tracking-wide">Notes · Ghi chú</p>
        <textarea
          value={noteEn}
          onChange={(e) => setNoteEn(e.target.value)}
          rows={2}
          placeholder="Notes (English)"
          className="w-full rounded-xl border border-border px-3 py-2 text-sm"
        />
        <textarea
          value={noteVi}
          onChange={(e) => setNoteVi(e.target.value)}
          rows={2}
          placeholder="Ghi chú (Tiếng Việt)"
          className="w-full rounded-xl border border-border px-3 py-2 text-sm"
        />
      </Card>

      {problem && (
        <p className="flex items-start gap-2 text-sm rounded-xl border border-warning bg-warning-tint text-warning px-3 py-2.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {problem}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button variant="ghost" className="flex-1 text-sm" onClick={onCancel}>
            Cancel · Hủy
          </Button>
        )}
        <Button className="flex-1 text-sm" onClick={save}>
          {saveLabel.en}
          {saveLabel.vi ? ` · ${saveLabel.vi}` : ""}
        </Button>
      </div>
    </div>
  );
}
