using System.ComponentModel;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;

public class RecipeDataPlugin
{
    private readonly AppDbContext _db;

    public RecipeDataPlugin(AppDbContext db) => _db = db;

    [KernelFunction("get_user_recipes")]
    [Description("Gets the titles and ingredients of a user's saved recipes")]
    public async Task<string> GetUserRecipesAsync(
        [Description("The user's id")] int userId)
    {
        var recipes = await _db.Recipes
            .Where(r => r.UserId == userId)
            .Select(r => new { r.Title, r.Ingredients, r.Category })
            .ToListAsync();

        if (recipes.Count == 0) return "This user has no saved recipes yet.";
        return string.Join("\n", recipes.Select(r =>
            $"- {r.Title} ({r.Category}): {r.Ingredients}"));
    }

    [KernelFunction("get_weekly_meal_plan")]
    [Description("Gets the user's current weekly meal plan, day by day")]
    public async Task<string> GetWeeklyMealPlanAsync(
        [Description("The user's id")] int userId)
    {
        var plan = await _db.MealPlans
            .Where(p => p.UserId == userId)
            .Include(p => p.Recipe)
            .OrderBy(p => p.Day)
            .Select(p => new { p.Day, p.MealSlot, RecipeTitle = p.Recipe.Title })
            .ToListAsync();

        if (plan.Count == 0) return "No meal plan has been created yet.";
        return string.Join("\n", plan.Select(p =>
            $"{p.Day} - {p.MealSlot}: {p.RecipeTitle}"));
    }

    [KernelFunction("get_user_preferences")]
    [Description("Gets the user's dietary goal, diet type, and allergies")]
    public async Task<string> GetUserPreferencesAsync(
        [Description("The user's id")] int userId)
    {
        var prefs = await _db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);

        if (prefs == null)
            return "This user has not set any dietary preferences yet — treat as no restrictions.";

        return $"Goal: {prefs.Goal}. Diet type: {prefs.DietType}. " +
            $"Allergies (MUST avoid these completely): {(string.IsNullOrWhiteSpace(prefs.Allergies) ? "none" : prefs.Allergies)}.";
    }
}
