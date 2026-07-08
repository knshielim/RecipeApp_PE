using System.Globalization;
using System.Text.RegularExpressions;

namespace Server.Services;

public record ParsedIngredient(string Name, double Quantity, string Unit, bool HasQuantity);

// Turns free-text ingredient strings ("1 onion, diced, 1/2 cup sugar, 2 cloves garlic")
// into structured entries. Prep notes after a comma ("diced", "finely chopped",
// "to taste") are recognised and discarded instead of becoming grocery items.
public static class IngredientParser
{
    // plural / synonym -> canonical unit
    private static readonly Dictionary<string, string> UnitMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["g"] = "g", ["gram"] = "g", ["grams"] = "g",
        ["kg"] = "kg", ["kilogram"] = "kg", ["kilograms"] = "kg",
        ["ml"] = "ml", ["milliliter"] = "ml", ["milliliters"] = "ml",
        ["millilitre"] = "ml", ["millilitres"] = "ml",
        ["l"] = "l", ["liter"] = "l", ["liters"] = "l", ["litre"] = "l", ["litres"] = "l",
        ["cup"] = "cup", ["cups"] = "cup",
        ["tbsp"] = "tbsp", ["tablespoon"] = "tbsp", ["tablespoons"] = "tbsp",
        ["tsp"] = "tsp", ["teaspoon"] = "tsp", ["teaspoons"] = "tsp",
        ["oz"] = "oz", ["ounce"] = "oz", ["ounces"] = "oz",
        ["lb"] = "lb", ["lbs"] = "lb", ["pound"] = "lb", ["pounds"] = "lb",
        ["piece"] = "piece", ["pieces"] = "piece",
        ["clove"] = "clove", ["cloves"] = "clove",
        ["slice"] = "slice", ["slices"] = "slice",
        ["pinch"] = "pinch", ["pinches"] = "pinch",
        ["can"] = "can", ["cans"] = "can",
    };

    // units converted to a base unit before aggregation, so 500 g + 1 kg = 1500 g
    private static readonly Dictionary<string, (string BaseUnit, double Factor)> BaseUnits = new()
    {
        ["kg"] = ("g", 1000),
        ["l"] = ("ml", 1000),
    };

    private static readonly Dictionary<char, double> UnicodeFractions = new()
    {
        ['¼'] = 0.25, ['½'] = 0.5, ['¾'] = 0.75,
        ['⅓'] = 1.0 / 3, ['⅔'] = 2.0 / 3,
        ['⅕'] = 0.2, ['⅖'] = 0.4, ['⅗'] = 0.6, ['⅘'] = 0.8,
        ['⅙'] = 1.0 / 6, ['⅚'] = 5.0 / 6,
        ['⅛'] = 0.125, ['⅜'] = 0.375, ['⅝'] = 0.625, ['⅞'] = 0.875,
    };

    // Leading quantity: "2", "1.5", "1/2", "1 1/2", "½", "1½"
    private const string Fr = "¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞";

    private static readonly Regex QuantityPattern = new(
        $@"^\s*(?:(?<whole>\d+(?:\.\d+)?)\s+(?<num>\d+)\s*/\s*(?<den>\d+)" +
        $@"|(?<whole>\d+(?:\.\d+)?)\s*(?<uni>[{Fr}])" +
        $@"|(?<num>\d+)\s*/\s*(?<den>\d+)" +
        $@"|(?<whole>\d+(?:\.\d+)?)" +
        $@"|(?<uni>[{Fr}]))\s*",
        RegexOptions.Compiled);

    private static readonly HashSet<string> PrepWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "diced", "sliced", "chopped", "minced", "beaten", "grated", "melted",
        "softened", "crushed", "peeled", "drained", "rinsed", "cooked", "thawed",
        "shredded", "cubed", "julienned", "trimmed", "halved", "quartered",
        "mashed", "toasted", "whisked", "washed", "deseeded", "pitted", "zested",
        "juiced", "separated", "sifted", "divided", "crumbled", "torn",
    };

    private static readonly HashSet<string> PrepAdverbs = new(StringComparer.OrdinalIgnoreCase)
    {
        "finely", "roughly", "thinly", "coarsely", "freshly", "lightly", "very", "and",
    };

    private static readonly string[] PrepPhrases =
    {
        "to taste", "for garnish", "for serving", "room temperature",
        "plus more", "optional", "as needed", "if needed",
    };

    // Splits a recipe's comma-separated ingredients string into ingredient entries,
    // dropping segments that are prep notes rather than new ingredients.
    public static IEnumerable<string> SplitEntries(string? ingredients)
    {
        if (string.IsNullOrWhiteSpace(ingredients))
        {
            yield break;
        }

        foreach (var raw in ingredients.Split(','))
        {
            var segment = raw.Trim();

            if (segment.Length == 0 || IsPrepNote(segment))
            {
                continue;
            }

            yield return segment;
        }
    }

    public static ParsedIngredient Parse(string text)
    {
        var trimmed = text.Trim();
        var match = QuantityPattern.Match(trimmed);
        var quantity = ReadQuantity(match);

        if (quantity is null)
        {
            return new ParsedIngredient(trimmed, 1, "", false);
        }

        var rest = trimmed[match.Length..].Trim();

        if (rest.Length == 0)
        {
            // A bare number is not a usable ingredient; keep the original text.
            return new ParsedIngredient(trimmed, 1, "", false);
        }

        var (unit, name) = SplitUnit(rest);

        if (name.Length == 0)
        {
            // "2 cups" with no ingredient name — treat as unparsed.
            return new ParsedIngredient(trimmed, 1, "", false);
        }

        return new ParsedIngredient(name, quantity.Value, unit, true);
    }

    // Converts kg -> g and l -> ml so identical ingredients aggregate together.
    public static (double Quantity, string Unit) ToBaseUnit(double quantity, string unit)
    {
        if (BaseUnits.TryGetValue(unit, out var baseUnit))
        {
            return (quantity * baseUnit.Factor, baseUnit.BaseUnit);
        }

        return (quantity, unit);
    }

    // Converts an aggregated base quantity back to the friendlier display unit
    // (1500 g -> 1.5 kg, 1250 ml -> 1.25 l).
    public static (double Quantity, string Unit) ToDisplayUnit(double quantity, string unit)
    {
        if (quantity >= 1000 && unit is "g" or "ml")
        {
            return (quantity / 1000, unit == "g" ? "kg" : "l");
        }

        return (quantity, unit);
    }

    private static double? ReadQuantity(Match match)
    {
        double? value = null;

        if (match.Groups["whole"].Success)
        {
            value = double.Parse(match.Groups["whole"].Value, CultureInfo.InvariantCulture);
        }

        if (match.Groups["num"].Success)
        {
            var den = double.Parse(match.Groups["den"].Value, CultureInfo.InvariantCulture);

            if (den > 0)
            {
                var fraction = double.Parse(match.Groups["num"].Value, CultureInfo.InvariantCulture) / den;
                value = (value ?? 0) + fraction;
            }
        }
        else if (match.Groups["uni"].Success)
        {
            value = (value ?? 0) + UnicodeFractions[match.Groups["uni"].Value[0]];
        }

        return value;
    }

    private static (string Unit, string Name) SplitUnit(string rest)
    {
        var space = rest.IndexOf(' ');
        var firstWord = space < 0 ? rest : rest[..space];

        if (UnitMap.TryGetValue(firstWord, out var canonical))
        {
            var name = space < 0 ? "" : rest[(space + 1)..].Trim();

            // "2 cups of flour" -> "flour"
            if (name.StartsWith("of ", StringComparison.OrdinalIgnoreCase))
            {
                name = name[3..].Trim();
            }

            return (canonical, name);
        }

        return ("", rest);
    }

    private static bool IsPrepNote(string segment)
    {
        // A segment that starts with a quantity is always a new ingredient.
        if (char.IsDigit(segment[0]) || UnicodeFractions.ContainsKey(segment[0]))
        {
            return false;
        }

        var lower = segment.ToLowerInvariant();

        if (PrepPhrases.Any(p => lower == p || lower.StartsWith(p + " ") || lower.EndsWith(" " + p)))
        {
            return true;
        }

        var words = lower.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var index = 0;

        while (index < words.Length && PrepAdverbs.Contains(words[index]))
        {
            index++;
        }

        return index < words.Length && words.Skip(index).All(w => PrepWords.Contains(w));
    }
}
