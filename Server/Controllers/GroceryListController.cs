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
[Route("api/mealplans/grocery-list")]
public class GroceryListController : ControllerBase
{
    private readonly AppDbContext _db;

    public GroceryListController(AppDbContext db)
    {
        _db = db;
    }

    // GET api/mealplans/grocery-list?weekStart=2026-07-13
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? weekStart = null)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;
        var week = WeekDateHelper.ParseOrCurrent(weekStart);

        var items = await _db.GroceryListItems
            .Where(g => g.UserId == userId && g.WeekStartDate == week)
            .OrderBy(g => g.Name)
            .ToListAsync();

        var totalRecipes = await _db.MealPlans
            .CountAsync(m => m.UserId == userId && m.WeekStartDate == week);

        return Ok(new
        {
            weekStartDate = week.ToString("yyyy-MM-dd"),
            totalRecipes,
            items = items.Count > 0 ? items.Select(ToItemDto).ToList() : null,
        });
    }

    // POST api/mealplans/grocery-list/generate?weekStart=2026-07-13
    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromQuery] string? weekStart = null)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;
        var week = WeekDateHelper.ParseOrCurrent(weekStart);

        var plannedRecipes = await _db.MealPlans
            .Where(m => m.UserId == userId && m.WeekStartDate == week)
            .Include(m => m.Recipe)
            .Select(m => m.Recipe)
            .ToListAsync();

        var generated = GroceryListBuilder.Build(
            userId,
            week,
            plannedRecipes.Select(r => r.Ingredients)
        );

        var existing = await _db.GroceryListItems
            .Where(g => g.UserId == userId && g.WeekStartDate == week)
            .ToListAsync();

        var checkedKeys = existing
            .Where(g => g.IsChecked)
            .Select(ItemKey)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var item in generated)
        {
            item.IsChecked = checkedKeys.Contains(ItemKey(item));
        }

        var custom = existing.Where(g => g.IsCustom).ToList();

        _db.GroceryListItems.RemoveRange(existing.Where(g => !g.IsCustom));
        _db.GroceryListItems.AddRange(generated);

        await _db.SaveChangesAsync();

        var items = generated.Concat(custom)
            .OrderBy(g => g.Name, StringComparer.OrdinalIgnoreCase)
            .Select(ToItemDto)
            .ToList();

        return Ok(new
        {
            weekStartDate = week.ToString("yyyy-MM-dd"),
            totalRecipes = plannedRecipes.Count,
            items = (object?)items,
        });
    }

    // POST api/mealplans/grocery-list/items?weekStart=2026-07-13
    [HttpPost("items")]
    public async Task<IActionResult> AddItem(
        [FromBody] GroceryItemCreateDTO dto,
        [FromQuery] string? weekStart = null)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;

        if (dto == null)
        {
            return ErrorResponse(StatusCodes.Status400BadRequest, "Grocery item data is required.");
        }

        var name = dto.Name?.Trim() ?? "";

        if (name.Length == 0)
        {
            return ErrorResponse(StatusCodes.Status400BadRequest, "Item name is required.");
        }

        var unit = dto.Unit?.Trim() ?? "";
        var week = WeekDateHelper.ParseOrCurrent(weekStart);

        var duplicate = await _db.GroceryListItems.AnyAsync(g =>
            g.UserId == userId &&
            g.WeekStartDate == week &&
            g.Name.ToLower() == name.ToLower() &&
            g.Unit.ToLower() == unit.ToLower());

        if (duplicate)
        {
            return ErrorResponse(StatusCodes.Status409Conflict, "That item is already on the list.");
        }

        var item = new GroceryListItem
        {
            UserId = userId,
            WeekStartDate = week,
            Name = name,
            Quantity = dto.Quantity,
            Unit = unit,
            Occurrences = 0,
            IsCustom = true,
        };

        _db.GroceryListItems.Add(item);
        await _db.SaveChangesAsync();

        return Ok(ToItemDto(item));
    }

    // PATCH api/mealplans/grocery-list/items/{id}
    [HttpPatch("items/{id:int}")]
    public async Task<IActionResult> UpdateItem(int id, [FromBody] GroceryItemUpdateDTO dto)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;

        if (id <= 0)
        {
            return ErrorResponse(StatusCodes.Status400BadRequest, "Grocery item ID must be valid.");
        }

        if (dto == null)
        {
            return ErrorResponse(StatusCodes.Status400BadRequest, "Grocery item data is required.");
        }

        var item = await _db.GroceryListItems
            .FirstOrDefaultAsync(g => g.Id == id && g.UserId == userId);

        if (item == null)
        {
            return ErrorResponse(StatusCodes.Status404NotFound, "Grocery item not found.");
        }

        if (dto.IsChecked.HasValue)
        {
            item.IsChecked = dto.IsChecked.Value;
        }

        if (dto.Quantity.HasValue)
        {
            item.Quantity = dto.Quantity.Value;
        }

        if (dto.Unit != null)
        {
            item.Unit = dto.Unit.Trim();
        }

        if (dto.Name != null)
        {
            var name = dto.Name.Trim();

            if (name.Length == 0)
            {
                return ErrorResponse(StatusCodes.Status400BadRequest, "Item name cannot be empty.");
            }

            item.Name = name;
        }

        await _db.SaveChangesAsync();

        return Ok(ToItemDto(item));
    }

    // DELETE api/mealplans/grocery-list/items/{id}
    [HttpDelete("items/{id:int}")]
    public async Task<IActionResult> DeleteItem(int id)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;

        if (id <= 0)
        {
            return ErrorResponse(StatusCodes.Status400BadRequest, "Grocery item ID must be valid.");
        }

        var item = await _db.GroceryListItems
            .FirstOrDefaultAsync(g => g.Id == id && g.UserId == userId);

        if (item == null)
        {
            return ErrorResponse(StatusCodes.Status404NotFound, "Grocery item not found.");
        }

        _db.GroceryListItems.Remove(item);
        await _db.SaveChangesAsync();

        return Ok(new { deleted = true });
    }

    // POST api/mealplans/grocery-list/uncheck-all?weekStart=2026-07-13
    [HttpPost("uncheck-all")]
    public async Task<IActionResult> UncheckAll([FromQuery] string? weekStart = null)
    {
        var userIdResult = GetCurrentUserId();
        if (userIdResult.Result != null) return userIdResult.Result;

        var userId = userIdResult.UserId;
        var week = WeekDateHelper.ParseOrCurrent(weekStart);

        var items = await _db.GroceryListItems
            .Where(g => g.UserId == userId && g.WeekStartDate == week && g.IsChecked)
            .ToListAsync();

        foreach (var item in items)
        {
            item.IsChecked = false;
        }

        await _db.SaveChangesAsync();

        return Ok(new { uncheckedCount = items.Count });
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

    private static object ToItemDto(GroceryListItem item) => new
    {
        id = item.Id,
        name = item.Name,
        quantity = item.Quantity,
        unit = item.Unit,
        occurrences = item.Occurrences,
        hasUnit = !string.IsNullOrWhiteSpace(item.Unit),
        isChecked = item.IsChecked,
        isCustom = item.IsCustom,
    };

    private static string ItemKey(GroceryListItem item) =>
        $"{item.Name.ToLowerInvariant()}|{item.Unit.ToLowerInvariant()}";

    private ObjectResult ErrorResponse(int statusCode, string message)
    {
        return StatusCode(statusCode, new ApiErrorResponse
        {
            StatusCode = statusCode,
            Message = message,
            TraceId = HttpContext?.TraceIdentifier ?? "",
        });
    }
}