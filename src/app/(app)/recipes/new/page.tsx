"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { RecipeEditor } from "@/components/RecipeEditor";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditRecipes } from "@/lib/auth/permissions";
import { blankRecipe, saveRecipe } from "@/lib/repo/recipes";
import type { Recipe } from "@/lib/types";

function NewRecipeContent() {
  const router = useRouter();
  const { session } = useSession();
  // A fresh id is picked once, at mount — not on every keystroke re-render.
  const draft = useMemo(() => blankRecipe(), []);

  if (!session) return null;
  if (!canEditRecipes(session.role)) {
    return (
      <div className="p-6 text-center text-muted mt-16">
        Not available for your role · Không khả dụng cho vai trò của bạn
      </div>
    );
  }

  const save = (recipe: Recipe) => {
    saveRecipe(recipe);
    router.replace(`/recipes/${recipe.id}`);
  };

  return (
    <div className="pb-10">
      <div className="px-4 md:px-8 pt-4 flex items-center gap-2">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-brand">
          <ChevronLeft size={24} />
        </button>
        <div>
          <p className="text-lg font-bold leading-tight">New recipe</p>
          <p className="text-sm text-muted leading-tight">Công thức mới</p>
        </div>
      </div>
      <div className="px-4 md:px-8 mt-4">
        <RecipeEditor
          initial={draft}
          onSave={save}
          onCancel={() => router.back()}
          saveLabel={{ en: "Add to the recipe book", vi: "Thêm vào sổ công thức" }}
        />
      </div>
    </div>
  );
}

export default function NewRecipePage() {
  return (
    <RoleGate module="recipes">
      <NewRecipeContent />
    </RoleGate>
  );
}
