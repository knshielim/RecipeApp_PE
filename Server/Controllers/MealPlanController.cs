using Server.DTO;
using Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace ServerApi.Controllers;

[ApiController]
[Route("api/mealplans")]
public class MealPlanController : ControllerBase
{
    private static readonly string[] ValidDays = AutoPlanBuilder.Days;

    private static readonly string[] ValidSlots = AutoPlanBuilder.Slots;

    private readonly AppDbContext _db;
    private readonly IMealPlanSuggester _suggester;

    public MealPlanController(AppDbContext db, IMealPlanSuggester suggester)
    {
        _db = db;
        _suggester = suggester;
    }

    // GET api/mealplans/{userId} -- the user's full weekly plan with recipe info
    [HttpGet("{userId:int}")]
    public async Task<IActionResult> GetMealPlans(int userId)
    {
        var plans = await _db.MealPlans
            .Where(m => m.UserId == userId)
            .Include(m => m.Recipe)
            .Select(m => new
            {
                m.Id,
                m.Day,
                m.MealSlot,
                m.RecipeId,
                RecipeTitle = m.Recipe.Title,
                RecipeCategory = m.Recipe.Category
            })
            .ToListAsync();

        return Ok(plans);
    }

    // GET api/mealplans/recipes/{userId} -- all recipes available for planning
    // (the dashboard endpoint only returns the 6 most recent, so we need our own)
    [HttpGet("recipes/{userId:int}")]
    public async Task<IActionResult> GetRecipes(int userId)
    {
        var recipes = await _db.Recipes
            .Where(r => r.UserId == userId)
            .OrderBy(r => r.Title)
            .Select(r => new { r.Id, r.Title, r.Category, r.ImageUrl })
            .ToListAsync();

        return Ok(recipes);
    }

    // POST api/mealplans -- assign a recipe to a day + meal slot
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] MealPlanRequestDTO request)
    {
        var error = await ValidateRequest(request);
        if (error != null) return error;

        var occupied = await _db.MealPlans.AnyAsync(m =>
            m.UserId == request.UserId &&
            m.Day == request.Day &&
            m.MealSlot == request.MealSlot);

        if (occupied)
            return Conflict(new { message = $"{request.Day} {request.MealSlot} already has a meal planned. Edit or remove it first." });

        var plan = new MealPlan
        {
            UserId = request.UserId,
            Day = request.Day,
            MealSlot = request.MealSlot,
            RecipeId = request.RecipeId
        };

        _db.MealPlans.Add(plan);
        await _db.SaveChangesAsync();

        return Ok(new { plan.Id, plan.Day, plan.MealSlot, plan.RecipeId });
    }

    // PUT api/mealplans/{id} -- change the recipe/day/slot of an existing entry
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] MealPlanRequestDTO request)
    {
        var plan = await _db.MealPlans.FindAsync(id);
        if (plan == null)
            return NotFound(new { message = "Meal plan entry not found." });

        var error = await ValidateRequest(request);
        if (error != null) return error;

        // Moving onto a day+slot already used by a DIFFERENT entry is a conflict
        var occupied = await _db.MealPlans.AnyAsync(m =>
            m.Id != id &&
            m.UserId == request.UserId &&
            m.Day == request.Day &&
            m.MealSlot == request.MealSlot);

        if (occupied)
            return Conflict(new { message = $"{request.Day} {request.MealSlot} already has a meal planned." });

        plan.Day = request.Day;
        plan.MealSlot = request.MealSlot;
        plan.RecipeId = request.RecipeId;

        await _db.SaveChangesAsync();

        return Ok(new { plan.Id, plan.Day, plan.MealSlot, plan.RecipeId });
    }

    // DELETE api/mealplans/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var plan = await _db.MealPlans.FindAsync(id);
        if (plan == null)
            return NotFound(new { message = "Meal plan entry not found." });

        _db.MealPlans.Remove(plan);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Meal plan entry deleted." });
    }

    // GET api/mealplans/{userId}/grocery-list
    // Aggregates the ingredients of every recipe in the user's weekly plan.
    // Recipe.Ingredients is a comma-separated string; where an entry embeds a
    // quantity (e.g. "200 g rice" / "2 eggs") quantities with the same unit are
    // summed, otherwise duplicates are counted as occurrences.
    [HttpGet("{userId:int}/grocery-list")]
    public async Task<IActionResult> GetGroceryList(int userId)
    {
        var plannedRecipes = await _db.MealPlans
            .Where(m => m.UserId == userId)
            .Include(m => m.Recipe)
            .Select(m => m.Recipe)
            .ToListAsync();

        // key: ingredient name (lowercase) + unit -> aggregated entry
        var aggregated = new Dictionary<string, GroceryItem>(StringComparer.OrdinalIgnoreCase);

        foreach (var recipe in plannedRecipes)
        {
            foreach (var raw in recipe.Ingredients.Split(','))
            {
                var text = raw.Trim();
                if (text.Length == 0) continue;

                var (name, quantity, unit) = ParseIngredient(text);
                var key = $"{name.ToLowerInvariant()}|{unit.ToLowerInvariant()}";

                if (aggregated.TryGetValue(key, out var existing))
                {
                    existing.Quantity += quantity;
                    existing.Occurrences += 1;
                }
                else
                {
                    aggregated[key] = new GroceryItem
                    {
                        Name = name,
                        Quantity = quantity,
                        Unit = unit,
                        Occurrences = 1
                    };
                }
            }
        }

        var items = aggregated.Values
            .OrderBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .Select(i => new
            {
                name = i.Name,
                // Only meaningful when the recipe text embedded quantities;
                // otherwise quantity == occurrences (each mention counted once).
                quantity = i.Quantity,
                unit = i.Unit,
                occurrences = i.Occurrences
            })
            .ToList();

        return Ok(new { totalRecipes = plannedRecipes.Count, items });
    }

    // POST api/mealplans/{userId}/auto-generate
    // Uses AI (with a deterministic fallback) to fill the entire week with
    // recipes matching the user's stored diet/goal/allergy preferences.
    // Replaces the user's existing weekly plan; individual entries remain
    // editable through the normal CRUD endpoints afterwards.
    [HttpPost("{userId:int}/auto-generate")]
    public async Task<IActionResult> AutoGenerate(int userId)
    {
        var recipes = await _db.Recipes.Where(r => r.UserId == userId).ToListAsync();
        if (recipes.Count == 0)
            return BadRequest(new { message = "You have no saved recipes to plan with." });

        var prefs = await _db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);

        var suggestions = await _suggester.SuggestWeekAsync(recipes, prefs);
        var week = AutoPlanBuilder.BuildWeek(recipes, prefs, suggestions);

        if (week.Count == 0)
            return BadRequest(new { message = "None of your recipes match your dietary preferences and allergies." });

        var existing = await _db.MealPlans.Where(m => m.UserId == userId).ToListAsync();
        _db.MealPlans.RemoveRange(existing);

        foreach (var entry in week)
        {
            _db.MealPlans.Add(new MealPlan
            {
                UserId = userId,
                Day = entry.Day,
                MealSlot = entry.MealSlot,
                RecipeId = entry.RecipeId
            });
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Generated a plan for {week.Count} meal slots.", slots = week.Count });
    }

    // POST api/mealplans/{userId}/apply-plan
    // Persists an exact weekly plan the user has already reviewed and
    // approved — e.g. the preview shown by the AI assistant's "Generate
    // weekly plan" action. Every entry is re-validated against this user's
    // own saved recipes before anything is written, and this replaces
    // whatever weekly plan the user already had.
    [HttpPost("{userId:int}/apply-plan")]
    public async Task<IActionResult> ApplyPlan(int userId, [FromBody] List<PlanEntryDTO> entries)
    {
        if (entries == null || entries.Count == 0)
            return BadRequest(new { message = "No plan entries provided." });

        var userRecipeIds = (await _db.Recipes
            .Where(r => r.UserId == userId)
            .Select(r => r.Id)
            .ToListAsync())
            .ToHashSet();

        var seen = new HashSet<(string Day, string Slot)>();
        var toSave = new List<MealPlan>();

        foreach (var entry in entries)
        {
            var day = ValidDays.FirstOrDefault(d => d.Equals(entry.Day, StringComparison.OrdinalIgnoreCase));
            var slot = ValidSlots.FirstOrDefault(s => s.Equals(entry.MealSlot, StringComparison.OrdinalIgnoreCase));
            if (day == null || slot == null) continue;
            if (!userRecipeIds.Contains(entry.RecipeId)) continue;
            if (!seen.Add((day, slot))) continue; // first entry per slot wins

            toSave.Add(new MealPlan { UserId = userId, Day = day, MealSlot = slot, RecipeId = entry.RecipeId });
        }

        if (toSave.Count == 0)
            return BadRequest(new { message = "None of the plan entries were valid for this user." });

        var existing = await _db.MealPlans.Where(m => m.UserId == userId).ToListAsync();
        _db.MealPlans.RemoveRange(existing);
        _db.MealPlans.AddRange(toSave);

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Saved your weekly plan ({toSave.Count} meal slots).", slots = toSave.Count });
    }

    // ---------- helpers ----------

    private async Task<IActionResult?> ValidateRequest(MealPlanRequestDTO request)
    {
        if (!ValidDays.Contains(request.Day))
            return BadRequest(new { message = "Day must be a valid weekday name (Monday–Sunday)." });

        if (!ValidSlots.Contains(request.MealSlot))
            return BadRequest(new { message = "Meal slot must be breakfast, lunch or dinner." });

        var recipeExists = await _db.Recipes.AnyAsync(r => r.Id == request.RecipeId && r.UserId == request.UserId);
        if (!recipeExists)
            return BadRequest(new { message = "Recipe not found for this user." });

        return null;
    }

    // Matches an optional leading quantity + optional unit, e.g.
    // "200 g rice" -> (rice, 200, g) | "2 eggs" -> (eggs, 2, "") | "rice" -> (rice, 1, "")
    private static readonly Regex QuantityPattern = new(
        @"^(?<qty>\d+(\.\d+)?)\s*(?<unit>g|kg|ml|l|cup|cups|tbsp|tsp|oz|lb|pieces?|cloves?|slices?)?\s+(?<name>.+)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static (string Name, double Quantity, string Unit) ParseIngredient(string text)
    {
        var match = QuantityPattern.Match(text);
        if (match.Success)
        {
            var name = match.Groups["name"].Value.Trim();
            var qty = double.Parse(match.Groups["qty"].Value, System.Globalization.CultureInfo.InvariantCulture);
            var unit = match.Groups["unit"].Value.Trim().ToLowerInvariant();
            return (name, qty, unit);
        }

        return (text, 1, "");
    }

    private class GroceryItem
    {
        public string Name { get; set; } = "";
        public double Quantity { get; set; }
        public string Unit { get; set; } = "";
        public int Occurrences { get; set; }
    }
}
public record PlanEntryDTO(string Day, string MealSlot, int RecipeId);