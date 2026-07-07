using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.DTO;
using Server.Models;
using Server.Services;

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

    // GET api/mealplans/{userId}?weekStart=2026-07-07
    [HttpGet("{userId:int}")]
    public async Task<IActionResult> GetMealPlans(int userId, [FromQuery] string? weekStart = null)
    {
        if (userId <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "User ID must be valid.");
        }

        var week = WeekDateHelper.ParseOrCurrent(weekStart);

        var plans = await _db.MealPlans
            .Where(m => m.UserId == userId && m.WeekStartDate == week)
            .Include(m => m.Recipe)
            .Select(m => new
            {
                m.Id,
                weekStartDate = m.WeekStartDate.ToString("yyyy-MM-dd"),
                m.Day,
                m.MealSlot,
                m.RecipeId,
                RecipeTitle = m.Recipe.Title,
                RecipeCategory = m.Recipe.Category
            })
            .ToListAsync();

        return Ok(plans);
    }

    // GET api/mealplans/recipes/{userId}
    [HttpGet("recipes/{userId:int}")]
    public async Task<IActionResult> GetRecipes(int userId)
    {
        if (userId <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "User ID must be valid.");
        }

        var recipes = await _db.Recipes
            .Where(r => r.UserId == userId)
            .OrderBy(r => r.Title)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.Category,
                r.ImageUrl
            })
            .ToListAsync();

        return Ok(recipes);
    }

    // POST api/mealplans
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] MealPlanRequestDTO request)
    {
        var week = WeekDateHelper.ParseOrCurrent(request.WeekStartDate);

        var error = await ValidateRequest(request);
        if (error != null)
        {
            return error;
        }

        var occupied = await _db.MealPlans.AnyAsync(m =>
            m.UserId == request.UserId &&
            m.WeekStartDate == week &&
            m.Day == request.Day &&
            m.MealSlot == request.MealSlot);

        if (occupied)
        {
            return ErrorResponse(
                StatusCodes.Status409Conflict,
                $"{request.Day} {request.MealSlot} already has a meal planned. Edit or remove it first.");
        }

        var plan = new MealPlan
        {
            UserId = request.UserId,
            WeekStartDate = week,
            Day = request.Day,
            MealSlot = request.MealSlot,
            RecipeId = request.RecipeId
        };

        _db.MealPlans.Add(plan);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            plan.Id,
            weekStartDate = week.ToString("yyyy-MM-dd"),
            plan.Day,
            plan.MealSlot,
            plan.RecipeId
        });
    }

    // PUT api/mealplans/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] MealPlanRequestDTO request)
    {
        var plan = await _db.MealPlans.FindAsync(id);

        if (plan == null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Meal plan entry not found.");
        }

        if (plan.UserId != request.UserId)
        {
            return ErrorResponse(
                StatusCodes.Status403Forbidden,
                "You cannot update a meal plan entry that belongs to another user.");
        }

        var week = WeekDateHelper.ParseOrCurrent(
            request.WeekStartDate ?? plan.WeekStartDate.ToString("yyyy-MM-dd"));

        var error = await ValidateRequest(request);
        if (error != null)
        {
            return error;
        }

        var occupied = await _db.MealPlans.AnyAsync(m =>
            m.Id != id &&
            m.UserId == request.UserId &&
            m.WeekStartDate == week &&
            m.Day == request.Day &&
            m.MealSlot == request.MealSlot);

        if (occupied)
        {
            return ErrorResponse(
                StatusCodes.Status409Conflict,
                $"{request.Day} {request.MealSlot} already has a meal planned.");
        }

        plan.WeekStartDate = week;
        plan.Day = request.Day;
        plan.MealSlot = request.MealSlot;
        plan.RecipeId = request.RecipeId;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            plan.Id,
            weekStartDate = week.ToString("yyyy-MM-dd"),
            plan.Day,
            plan.MealSlot,
            plan.RecipeId
        });
    }

    // DELETE api/mealplans/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var plan = await _db.MealPlans.FindAsync(id);

        if (plan == null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Meal plan entry not found.");
        }

        _db.MealPlans.Remove(plan);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Meal plan entry deleted." });
    }

    // GET api/mealplans/{userId}/grocery-list?weekStart=2026-07-07
    [HttpGet("{userId:int}/grocery-list")]
    public async Task<IActionResult> GetGroceryList(int userId, [FromQuery] string? weekStart = null)
    {
        if (userId <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "User ID must be valid.");
        }

        var week = WeekDateHelper.ParseOrCurrent(weekStart);

        var plannedRecipes = await _db.MealPlans
            .Where(m => m.UserId == userId && m.WeekStartDate == week)
            .Include(m => m.Recipe)
            .Select(m => m.Recipe)
            .ToListAsync();

        var aggregated = new Dictionary<string, GroceryItem>(StringComparer.OrdinalIgnoreCase);

        foreach (var recipe in plannedRecipes)
        {
            foreach (var raw in recipe.Ingredients.Split(','))
            {
                var text = raw.Trim();

                if (text.Length == 0)
                {
                    continue;
                }

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
                quantity = i.Quantity,
                unit = i.Unit,
                occurrences = i.Occurrences,
                hasUnit = !string.IsNullOrWhiteSpace(i.Unit)
            })
            .ToList();

        return Ok(new
        {
            weekStartDate = week.ToString("yyyy-MM-dd"),
            totalRecipes = plannedRecipes.Count,
            items
        });
    }

    // POST api/mealplans/{userId}/auto-generate?weekStart=2026-07-07
    [HttpPost("{userId:int}/auto-generate")]
    public async Task<IActionResult> AutoGenerate(int userId, [FromQuery] string? weekStart = null)
    {
        if (userId <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "User ID must be valid.");
        }

        var week = WeekDateHelper.ParseOrCurrent(weekStart);

        var recipes = await _db.Recipes
            .Where(r => r.UserId == userId)
            .ToListAsync();

        if (recipes.Count == 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "You have no saved recipes to plan with.");
        }

        var prefs = await _db.UserPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId);

        var suggestions = await _suggester.SuggestWeekAsync(recipes, prefs);
        var weekPlan = AutoPlanBuilder.BuildWeek(recipes, prefs, suggestions);

        if (weekPlan.Count == 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "None of your recipes match your dietary preferences and allergies.");
        }

        var existing = await _db.MealPlans
            .Where(m => m.UserId == userId && m.WeekStartDate == week)
            .ToListAsync();

        _db.MealPlans.RemoveRange(existing);

        foreach (var entry in weekPlan)
        {
            _db.MealPlans.Add(new MealPlan
            {
                UserId = userId,
                WeekStartDate = week,
                Day = entry.Day,
                MealSlot = entry.MealSlot,
                RecipeId = entry.RecipeId
            });
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Generated a plan for {weekPlan.Count} meal slots.",
            weekStartDate = week.ToString("yyyy-MM-dd"),
            slots = weekPlan.Count
        });
    }

    // POST api/mealplans/{userId}/apply-plan?weekStart=2026-07-07
    [HttpPost("{userId:int}/apply-plan")]
    public async Task<IActionResult> ApplyPlan(
        int userId,
        [FromBody] List<PlanEntryDTO> entries,
        [FromQuery] string? weekStart = null)
    {
        if (userId <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "User ID must be valid.");
        }

        if (entries == null || entries.Count == 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "No plan entries provided.");
        }

        var week = WeekDateHelper.ParseOrCurrent(weekStart);

        var userRecipeIds = (await _db.Recipes
            .Where(r => r.UserId == userId)
            .Select(r => r.Id)
            .ToListAsync())
            .ToHashSet();

        if (userRecipeIds.Count == 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "You have no saved recipes to save into a meal plan.");
        }

        var seen = new HashSet<(string Day, string Slot)>();
        var toSave = new List<MealPlan>();

        foreach (var entry in entries)
        {
            var day = ValidDays.FirstOrDefault(d =>
                d.Equals(entry.Day, StringComparison.OrdinalIgnoreCase));

            var slot = ValidSlots.FirstOrDefault(s =>
                s.Equals(entry.MealSlot, StringComparison.OrdinalIgnoreCase));

            if (day == null || slot == null)
            {
                continue;
            }

            if (!userRecipeIds.Contains(entry.RecipeId))
            {
                continue;
            }

            if (!seen.Add((day, slot)))
            {
                continue;
            }

            toSave.Add(new MealPlan
            {
                UserId = userId,
                WeekStartDate = week,
                Day = day,
                MealSlot = slot,
                RecipeId = entry.RecipeId
            });
        }

        if (toSave.Count == 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "None of the plan entries were valid for this user.");
        }

        var existing = await _db.MealPlans
            .Where(m => m.UserId == userId && m.WeekStartDate == week)
            .ToListAsync();

        _db.MealPlans.RemoveRange(existing);
        _db.MealPlans.AddRange(toSave);

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Saved your weekly plan ({toSave.Count} meal slots).",
            weekStartDate = week.ToString("yyyy-MM-dd"),
            slots = toSave.Count
        });
    }

    private async Task<IActionResult?> ValidateRequest(MealPlanRequestDTO request)
    {
        if (!ValidDays.Contains(request.Day))
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Day must be a valid weekday name from Monday to Sunday.");
        }

        if (!ValidSlots.Contains(request.MealSlot))
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Meal slot must be breakfast, lunch, or dinner.");
        }

        var recipeExists = await _db.Recipes.AnyAsync(r =>
            r.Id == request.RecipeId &&
            r.UserId == request.UserId);

        if (!recipeExists)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Recipe not found for this user.");
        }

        return null;
    }

    private ObjectResult ErrorResponse(int statusCode, string message)
    {
        return StatusCode(statusCode, new ApiErrorResponse
        {
            StatusCode = statusCode,
            Message = message,
            TraceId = HttpContext.TraceIdentifier
        });
    }

    private static readonly Regex QuantityPattern = new(
        @"^(?<qty>\d+(\.\d+)?)\s*(?<unit>g|kg|ml|l|cup|cups|tbsp|tsp|oz|lb|pieces?|cloves?|slices?)?\s+(?<name>.+)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static (string Name, double Quantity, string Unit) ParseIngredient(string text)
    {
        var match = QuantityPattern.Match(text);

        if (match.Success)
        {
            var name = match.Groups["name"].Value.Trim();
            var qty = double.Parse(
                match.Groups["qty"].Value,
                System.Globalization.CultureInfo.InvariantCulture);

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