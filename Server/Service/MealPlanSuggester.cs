using System.Text.Json;
using Server.Models;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace Server.Services;

// One AI-proposed assignment of a recipe to a day + meal slot.
public record MealSlotSuggestion(string Day, string MealSlot, int RecipeId);

// Boundary for the AI call so the auto-planner can be tested with a fake.
public interface IMealPlanSuggester
{
    // May return partial, duplicated or invalid suggestions (or an empty list
    // when the AI is unavailable) — AutoPlanBuilder sanitizes the result.
    Task<List<MealSlotSuggestion>> SuggestWeekAsync(List<Recipe> recipes, UserPreference? prefs);
}

public class MealPlanSuggester : IMealPlanSuggester
{
    private readonly Kernel _kernel;

    public MealPlanSuggester(Kernel kernel)
    {
        _kernel = kernel;
    }

    public async Task<List<MealSlotSuggestion>> SuggestWeekAsync(List<Recipe> recipes, UserPreference? prefs)
    {
        try
        {
            var chat = _kernel.GetRequiredService<IChatCompletionService>();

            var recipeList = string.Join("\n", recipes.Select(r =>
                $"- id {r.Id}: {r.Title} (category: {r.Category}; ingredients: {r.Ingredients})"));

            var history = new ChatHistory();
            history.AddSystemMessage(
                "You are a meal-planning assistant. Assign the user's saved recipes to a full week " +
                "(Monday to Sunday, meal slots breakfast/lunch/dinner). " +
                $"User goal: {prefs?.Goal ?? "maintain"}. Diet type: {prefs?.DietType ?? "none"}. " +
                $"Allergies (NEVER assign a recipe containing these, even partially): {prefs?.Allergies ?? "none"}. " +
                "Vary the recipes across the week; avoid repeating the same recipe where the recipe count allows. " +
                "Available recipes:\n" + recipeList + "\n" +
                "Respond with ONLY a JSON array, no prose, in the form: " +
                "[{\"day\":\"Monday\",\"mealSlot\":\"breakfast\",\"recipeId\":1}, ...] covering all 21 slots.");
            history.AddUserMessage("Generate my weekly meal plan.");

            var settings = new OpenAIPromptExecutionSettings { FunctionChoiceBehavior = FunctionChoiceBehavior.Auto() };
            var result = await chat.GetChatMessageContentAsync(history, settings, _kernel);

            return ParseSuggestions(result.Content ?? "");
        }
        catch
        {
            // No AI configured, request failed or unparseable output — the
            // caller falls back to deterministic planning.
            return new List<MealSlotSuggestion>();
        }
    }

    // Extracts the first JSON array from the model output (models often wrap
    // JSON in markdown fences) and maps it to suggestions.
    public static List<MealSlotSuggestion> ParseSuggestions(string content)
    {
        var start = content.IndexOf('[');
        var end = content.LastIndexOf(']');
        if (start < 0 || end <= start) return new List<MealSlotSuggestion>();

        try
        {
            var json = content.Substring(start, end - start + 1);
            var parsed = JsonSerializer.Deserialize<List<MealSlotSuggestion>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return parsed ?? new List<MealSlotSuggestion>();
        }
        catch (JsonException)
        {
            return new List<MealSlotSuggestion>();
        }
    }
}

// Pure planning logic: turns (recipes, preferences, raw AI suggestions) into a
// complete, validated 7x3 week. Deterministic and fully unit-testable.
public static class AutoPlanBuilder
{
    public static readonly string[] Days =
        { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };

    public static readonly string[] Slots = { "breakfast", "lunch", "dinner" };

    public static List<MealSlotSuggestion> BuildWeek(
        List<Recipe> recipes,
        UserPreference? prefs,
        List<MealSlotSuggestion> aiSuggestions)
    {
        // Only ever plan from the user's own saved recipes that also satisfy
        // their allergies AND diet type — nothing outside this set can end up
        // in the plan, no matter what the AI suggests.
        var allowed = FilterByDietType(FilterAllergens(recipes, prefs), prefs);
        if (allowed.Count == 0) return new List<MealSlotSuggestion>();

        var allowedIds = allowed.Select(r => r.Id).ToHashSet();
        var plan = new Dictionary<(string Day, string Slot), int>();
        var usage = allowed.ToDictionary(r => r.Id, _ => 0);

        // 1. Keep valid AI suggestions: known day/slot, allowed recipe, first
        //    suggestion per slot wins.
        foreach (var s in aiSuggestions)
        {
            var day = Days.FirstOrDefault(d => d.Equals(s.Day, StringComparison.OrdinalIgnoreCase));
            var slot = Slots.FirstOrDefault(sl => sl.Equals(s.MealSlot, StringComparison.OrdinalIgnoreCase));
            if (day == null || slot == null) continue;
            if (!allowedIds.Contains(s.RecipeId)) continue;
            if (plan.ContainsKey((day, slot))) continue;

            plan[(day, slot)] = s.RecipeId;
            usage[s.RecipeId]++;
        }

        // 2. Fill any remaining slots deterministically, always picking the
        //    least-used allowed recipe so the week stays varied.
        foreach (var day in Days)
        {
            foreach (var slot in Slots)
            {
                if (plan.ContainsKey((day, slot))) continue;

                var pick = allowed
                    .OrderBy(r => usage[r.Id])
                    .ThenBy(r => r.Id)
                    .First();

                plan[(day, slot)] = pick.Id;
                usage[pick.Id]++;
            }
        }

        return Days
            .SelectMany(day => Slots.Select(slot => new MealSlotSuggestion(day, slot, plan[(day, slot)])))
            .ToList();
    }

    // Removes recipes whose ingredient text contains any listed allergen
    // (case-insensitive substring, so "peanuts" also excludes "peanut butter"
    // via the singular token check below).
    public static List<Recipe> FilterAllergens(List<Recipe> recipes, UserPreference? prefs)
    {
        var allergens = (prefs?.Allergies ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(a => a.Length > 0)
            .ToList();

        if (allergens.Count == 0) return recipes.ToList();

        return recipes
            .Where(r => !allergens.Any(a => ContainsAllergen(r.Ingredients, a)))
            .ToList();
    }

    private static bool ContainsAllergen(string ingredients, string allergen)
    {
        // Match the allergen and its singular form ("peanuts" -> "peanut"),
        // so "peanut butter" is caught when the allergy is "peanuts".
        var singular = allergen.EndsWith("s", StringComparison.OrdinalIgnoreCase)
            ? allergen[..^1]
            : allergen;

        return ingredients.Contains(allergen, StringComparison.OrdinalIgnoreCase)
            || ingredients.Contains(singular, StringComparison.OrdinalIgnoreCase);
    }

    // Removes recipes that don't fit the user's stored diet type. Uses the
    // same case-insensitive substring approach as FilterAllergens, since
    // Recipe has no structured diet tags — only a free-text ingredient list.
    // Unrecognised or "none" diet types are not filtered at all.
    public static List<Recipe> FilterByDietType(List<Recipe> recipes, UserPreference? prefs)
    {
        var diet = (prefs?.DietType ?? "none").Trim().ToLowerInvariant();

        return diet switch
        {
            "vegan" => recipes
                .Where(r => !ContainsAny(r.Ingredients, MeatKeywords)
                         && !ContainsAny(r.Ingredients, AnimalProductKeywords))
                .ToList(),
            "vegetarian" => recipes
                .Where(r => !ContainsAny(r.Ingredients, MeatKeywords))
                .ToList(),
            "pescatarian" => recipes
                .Where(r => !ContainsAny(r.Ingredients, LandMeatKeywords))
                .ToList(),
            "halal" => recipes
                .Where(r => !ContainsAny(r.Ingredients, NonHalalKeywords))
                .ToList(),
            _ => recipes.ToList(), // "none" or an unrecognised diet type
        };
    }

    private static readonly string[] MeatKeywords =
    {
        "chicken", "beef", "pork", "bacon", "ham", "sausage", "lamb", "mutton", "turkey",
        "duck", "veal", "venison", "fish", "salmon", "tuna", "shrimp", "prawn", "crab",
        "lobster", "squid", "octopus", "anchovy", "sardine", "seafood", "meat"
    };

    // MeatKeywords minus seafood, since pescatarians do eat fish/shellfish.
    private static readonly string[] LandMeatKeywords = MeatKeywords
        .Where(k => k is not ("fish" or "salmon" or "tuna" or "shrimp" or "prawn" or "crab"
                           or "lobster" or "squid" or "octopus" or "anchovy" or "sardine" or "seafood"))
        .ToArray();

    private static readonly string[] AnimalProductKeywords =
    {
        "milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "egg", "honey", "ghee",
        "mayonnaise", "gelatin", "whey", "casein"
    };

    private static readonly string[] NonHalalKeywords =
    {
        "pork", "bacon", "ham", "lard", "pepperoni", "prosciutto",
        "wine", "beer", "alcohol", "rum", "sake", "brandy", "vodka", "gelatin"
    };

    private static bool ContainsAny(string ingredients, IEnumerable<string> keywords)
        => keywords.Any(k => ingredients.Contains(k, StringComparison.OrdinalIgnoreCase));
}