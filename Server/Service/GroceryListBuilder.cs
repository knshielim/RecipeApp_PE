using Server.Models;

namespace Server.Services;

// Aggregates the ingredients of a week's planned recipes into grocery list items.
public static class GroceryListBuilder
{
    public static List<GroceryListItem> Build(
        int userId,
        DateOnly weekStart,
        IEnumerable<string> recipeIngredientStrings)
    {
        var aggregated = new Dictionary<string, GroceryListItem>(StringComparer.OrdinalIgnoreCase);

        foreach (var ingredients in recipeIngredientStrings)
        {
            foreach (var entry in IngredientParser.SplitEntries(ingredients))
            {
                var parsed = IngredientParser.Parse(entry);
                var (quantity, unit) = IngredientParser.ToBaseUnit(parsed.Quantity, parsed.Unit);
                var key = $"{parsed.Name.ToLowerInvariant()}|{unit.ToLowerInvariant()}";

                if (aggregated.TryGetValue(key, out var existing))
                {
                    existing.Quantity += quantity;
                    existing.Occurrences += 1;
                }
                else
                {
                    aggregated[key] = new GroceryListItem
                    {
                        UserId = userId,
                        WeekStartDate = weekStart,
                        Name = parsed.Name,
                        Quantity = quantity,
                        Unit = unit,
                        Occurrences = 1,
                    };
                }
            }
        }

        // Convert aggregated base quantities to friendlier display units (1500 g -> 1.5 kg).
        foreach (var item in aggregated.Values)
        {
            var (quantity, unit) = IngredientParser.ToDisplayUnit(item.Quantity, item.Unit);
            item.Quantity = quantity;
            item.Unit = unit;
        }

        return aggregated.Values
            .OrderBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
