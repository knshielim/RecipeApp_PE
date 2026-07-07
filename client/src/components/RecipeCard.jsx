import { Link } from "react-router-dom";
import { getCategoryGradient } from "../utils/recipeCategoryColors";
import { formatDietRestriction } from "../utils/dietLabels";

export default function RecipeCard({ recipe, favoriteButton, detailPath }) {
  const gradient = getCategoryGradient(recipe.category);
  const dietLabel = formatDietRestriction(recipe.dietRestriction);
  
  const allergens = recipe.allergens ? recipe.allergens.split(',').filter(Boolean) : [];

  return (
    <article className="soft-card flex flex-col p-4 hover:shadow-lg transition-shadow duration-200 relative h-full">
      {favoriteButton}

      <div className="w-full aspect-square shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 mb-3">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-4xl`}
          >
            🍽️
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col min-h-[8rem]">
        <h3 className="font-bold text-slate-900 text-lg leading-snug line-clamp-2 min-h-[2.5rem]">
          {recipe.title}
        </h3>

        <div className="mt-3 space-y-1.5">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-800">Category:</span>{" "}
            <span className="font-bold text-slate-700">{recipe.category}</span>
          </p>
          {dietLabel && (
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-800">Diet:</span>{" "}
              <span className="font-bold text-slate-700">{dietLabel}</span>
            </p>
          )}
          {recipe.ownerName && (
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-800">Owner:</span>{" "}
              <span className="font-bold text-slate-700">{recipe.ownerName}</span>
            </p>
          )}
          {allergens.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {allergens.map((allergen, index) => (
                <span
                  key={index}
                  className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium"
                >
                  Contains {allergen}
                </span>
              ))}
            </div>
          )}
        </div>

        {detailPath && (
          <Link
            to={detailPath}
            className="mt-auto pt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand/80 hover:underline w-fit"
          >
            View more details
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
      </div>
    </article>
  );
}
