using System.Text.RegularExpressions;
using Server.Models;

namespace Server.Services;

public static class RecipeSeedEnricher
{
    private static readonly string[] DietOptions = ["none", "vegetarian", "vegan", "halal", "keto", "gluten-free", "dairy-free", "nut-free", "low-carb", "paleo", "low-sodium", "sugar-free", "whole30", "mediterranean", "pescatarian"];

    public static void Enrich(Recipe recipe, int index, IReadOnlyList<User> ownerPool)
    {
        if (ownerPool.Count > 0)
        {
            var pick = Math.Abs($"{recipe.Title}{index}".GetHashCode()) % ownerPool.Count;
            recipe.OwnerName = ownerPool[pick].FullName;
        }

        if (string.IsNullOrWhiteSpace(recipe.DietRestriction))
            recipe.DietRestriction = PickDiet(recipe, index);

        if (string.IsNullOrWhiteSpace(recipe.Allergens))
            recipe.Allergens = DetectAllergens(recipe.Ingredients);

        if (string.IsNullOrWhiteSpace(recipe.ImageUrl))
        {
            recipe.ImageUrl = $"/{recipe.Title}.png";
        }

        if (string.IsNullOrWhiteSpace(recipe.Steps))
            recipe.Steps = BuildSteps(recipe);

        recipe.Ingredients = FormatIngredients(recipe.Ingredients);
    }

    private static string PickDiet(Recipe recipe, int index)
    {
        var ingredients = recipe.Ingredients.ToLowerInvariant();
        var hasMeat = Regex.IsMatch(ingredients, @"\b(chicken|beef|pork|shrimp|bacon|turkey|lamb|ham|sausage)\b");
        var hasFish = Regex.IsMatch(ingredients, @"\b(fish|salmon|tuna|cod|shrimp|crab|lobster)\b");
        var hasDairy = Regex.IsMatch(ingredients, @"\b(milk|cheese|yogurt|butter|cream|parmesan|mozzarella)\b");
        var hasEgg = ingredients.Contains("egg");
        var hasGluten = Regex.IsMatch(ingredients, @"\b(wheat|flour|bread|pasta|barley|rye)\b");
        var hasNuts = Regex.IsMatch(ingredients, @"\b(peanut|almond|walnut|cashew|pecan|pistachio|hazelnut)\b");
        var hasSoy = ingredients.Contains("soy");
        var hasHighCarb = Regex.IsMatch(ingredients, @"\b(rice|pasta|bread|potato|sugar|honey)\b");

        // Vegan: no meat, fish, dairy, eggs
        if (!hasMeat && !hasFish && !hasDairy && !hasEgg)
            return "vegan";

        // Vegetarian: no meat or fish
        if (!hasMeat && !hasFish)
            return "vegetarian";

        // Pescatarian: fish but no other meat
        if (hasFish && !hasMeat)
            return "pescatarian";

        // Gluten-free: no gluten ingredients
        if (!hasGluten)
            return "gluten-free";

        // Dairy-free: no dairy
        if (!hasDairy)
            return "dairy-free";

        // Nut-free: no nuts
        if (!hasNuts)
            return "nut-free";

        // Low-carb: no high carb ingredients
        if (!hasHighCarb)
            return "low-carb";

        // Randomly assign from remaining options
        var pick = Math.Abs($"{recipe.Title}{index}diet".GetHashCode()) % DietOptions.Length;
        var selected = DietOptions[pick];
        
        // Avoid assigning vegan/vegetarian to meat dishes
        if (hasMeat && (selected == "vegan" || selected == "vegetarian" || selected == "pescatarian"))
            return "none";
        
        return selected;
    }

    private static string DetectAllergens(string ingredients)
    {
        var lower = ingredients.ToLowerInvariant();
        var allergens = new List<string>();

        if (Regex.IsMatch(lower, @"\b(peanut|peanuts)\b")) allergens.Add("Peanuts");
        if (Regex.IsMatch(lower, @"\b(almond|walnut|cashew|pecan|pistachio|hazelnut|macadamia)\b")) allergens.Add("Tree Nuts");
        if (Regex.IsMatch(lower, @"\b(milk|cheese|yogurt|butter|cream)\b")) allergens.Add("Dairy");
        if (lower.Contains("egg")) allergens.Add("Eggs");
        if (Regex.IsMatch(lower, @"\b(fish|salmon|tuna|cod)\b")) allergens.Add("Fish");
        if (Regex.IsMatch(lower, @"\b(shrimp|crab|lobster|shellfish)\b")) allergens.Add("Shellfish");
        if (lower.Contains("soy")) allergens.Add("Soy");
        if (Regex.IsMatch(lower, @"\b(wheat|flour|bread|pasta|barley|rye)\b")) allergens.Add("Wheat");
        if (lower.Contains("sesame")) allergens.Add("Sesame");
        if (lower.Contains("corn")) allergens.Add("Corn");
        if (lower.Contains("mustard")) allergens.Add("Mustard");

        return allergens.Count > 0 ? string.Join(", ", allergens) : "";
    }

    private static string BuildSteps(Recipe recipe) =>
        $"1. Gather and prep all ingredients for {recipe.Title}.\n" +
        $"2. Cook the main components following standard {recipe.Category.ToLowerInvariant()} technique.\n" +
        $"3. Combine, season to taste, and plate.\n" +
        $"4. Serve warm and enjoy your {recipe.Title}.";

    private static string FormatIngredients(string raw) =>
        string.Join(", ",
            raw.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
               .Select(FormatOneIngredient));

    private static string FormatOneIngredient(string ingredient)
    {
        if (Regex.IsMatch(ingredient, @"^\d"))
            return ingredient;

        var lower = ingredient.ToLowerInvariant();

        if (lower.Contains("egg")) return $"2 {ingredient}";
        if (lower.Contains("rice") || lower.Contains("oats") || lower.Contains("flour"))
            return $"200 g {ingredient}";
        if (lower.Contains("milk") || lower.Contains("broth") || lower.Contains("stock"))
            return $"250 ml {ingredient}";
        if (lower.Contains("oil") || lower.Contains("sauce") || lower.Contains("vinegar"))
            return $"2 tbsp {ingredient}";
        if (lower.Contains("bread") || lower.Contains("tortilla") || lower.Contains("bun"))
            return $"2 slices {ingredient}";
        if (lower.Contains("garlic")) return $"3 cloves {ingredient}";
        if (lower.Contains("onion")) return $"1 {ingredient}";
        if (lower.Contains("cheese")) return $"100 g {ingredient}";
        if (lower.Contains("chicken") || lower.Contains("beef") || lower.Contains("pork") || lower.Contains("fish"))
            return $"300 g {ingredient}";

        return $"1 {ingredient}";
    }
}
