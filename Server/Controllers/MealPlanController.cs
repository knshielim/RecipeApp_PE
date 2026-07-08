using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.DTO;
using Server.Models;
using Server.Services;

namespace ServerApi.Controllers;

[ApiController]
[Authorize]
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

    // GET api/mealplans?weekStart=2026-07-07
    [HttpGet]
    public async Task<IActionResult> GetMealPlans([FromQuery] string? weekStart = null)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;
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

    // GET api/mealplans/recipes
    [HttpGet("recipes")]
    public async Task<IActionResult> GetRecipes()
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;

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
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;

        if (request == null)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Meal plan data is required.");
        }

        var week = WeekDateHelper.ParseOrCurrent(request.WeekStartDate);

        var error = await ValidateRequest(request, userId);
        if (error != null)
        {
            return error;
        }

        var occupied = await _db.MealPlans.AnyAsync(m =>
            m.UserId == userId &&
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
            UserId = userId,
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
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;

        if (request == null)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Meal plan data is required.");
        }

        if (id <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Meal plan entry ID must be valid.");
        }

        var plan = await _db.MealPlans
            .FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId);

        if (plan == null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Meal plan entry not found.");
        }

        var week = WeekDateHelper.ParseOrCurrent(
            request.WeekStartDate ?? plan.WeekStartDate.ToString("yyyy-MM-dd"));

        var error = await ValidateRequest(request, userId);
        if (error != null)
        {
            return error;
        }

        var occupied = await _db.MealPlans.AnyAsync(m =>
            m.Id != id &&
            m.UserId == userId &&
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
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;

        if (id <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Meal plan entry ID must be valid.");
        }

        var plan = await _db.MealPlans
            .FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId);

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

    // POST api/mealplans/auto-generate?weekStart=2026-07-07
    [HttpPost("auto-generate")]
    public async Task<IActionResult> AutoGenerate([FromQuery] string? weekStart = null)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;
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

    // POST api/mealplans/apply-plan?weekStart=2026-07-07
    [HttpPost("apply-plan")]
    public async Task<IActionResult> ApplyPlan(
        [FromBody] List<PlanEntryDTO> entries,
        [FromQuery] string? weekStart = null)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;

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

    private async Task<IActionResult?> ValidateRequest(MealPlanRequestDTO request, int userId)
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
            r.UserId == userId);

        if (!recipeExists)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Recipe not found for this user.");
        }

        return null;
    }

    private (int UserId, IActionResult? Result) GetCurrentUserId()
    {
        var username =
            User.FindFirst(ClaimTypes.Name)?.Value ??
            User.FindFirst("username")?.Value ??
            User.FindFirst("unique_name")?.Value ??
            User.Identity?.Name;

        if (string.IsNullOrWhiteSpace(username))
        {
            return (0, ErrorResponse(StatusCodes.Status401Unauthorized, "You must be logged in."));
        }

        var userId = UserIdResolver.GetUserId(username);

        if (userId <= 0)
        {
            return (0, ErrorResponse(StatusCodes.Status401Unauthorized, "Could not resolve the current user."));
        }

        return (userId, null);
    }

    private ObjectResult ErrorResponse(int statusCode, string message)
    {
        return StatusCode(statusCode, new ApiErrorResponse
        {
            StatusCode = statusCode,
            Message = message,
            TraceId = HttpContext?.TraceIdentifier ?? ""
        });
    }
}

public record PlanEntryDTO(string Day, string MealSlot, int RecipeId);