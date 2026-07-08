using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.DTO;
using Server.Models;
using Server.Services;

namespace ServerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly UserStore _users;
    private readonly AppDbContext _db;

    public AdminController(UserStore users, AppDbContext db)
    {
        _users = users;
        _db = db;
    }

    // GET api/admin/users
    [HttpGet("users")]
    public IActionResult GetUsers()
    {
        var users = _users.GetAll()
            .Select(u => new
            {
                u.Username,
                u.Role,
                u.CreatedAt,
                u.FullName,
                u.Email,
                u.PhoneNumber,
                u.DateOfBirth,
                u.Gender,
                u.IsActive
            });

        return Ok(users);
    }

    // PUT api/admin/users/{username}/status
    [HttpPut("users/{username}/status")]
    public IActionResult UpdateStatus(string username, [FromBody] UpdateUserStatusDTO dto)
    {
        var me = User.Identity?.Name;

        if (string.Equals(me, username, StringComparison.OrdinalIgnoreCase))
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "You cannot deactivate your own account.");
        }

        if (!_users.SetActive(username, dto.IsActive))
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "User not found.");
        }

        return Ok(new
        {
            message = $"'{username}' is now {(dto.IsActive ? "active" : "deactivated")}.",
            isActive = dto.IsActive
        });
    }

    // DELETE api/admin/users/{username}
    [HttpDelete("users/{username}")]
    public IActionResult DeleteUser(string username)
    {
        var me = User.Identity?.Name;

        if (string.Equals(me, username, StringComparison.OrdinalIgnoreCase))
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "You cannot delete your own account.");
        }

        if (!_users.Remove(username))
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "User not found.");
        }

        return Ok(new { message = $"User '{username}' deleted." });
    }

    // PUT api/admin/users/{username}/role
    [HttpPut("users/{username}/role")]
    public IActionResult UpdateRole(string username, [FromBody] UpdateRoleDTO dto)
    {
        if (dto.Role != "Admin" && dto.Role != "User")
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Role must be either Admin or User.");
        }

        var me = User.Identity?.Name;

        if (string.Equals(me, username, StringComparison.OrdinalIgnoreCase))
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "You cannot change your own role.");
        }

        if (!_users.UpdateRole(username, dto.Role))
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "User not found.");
        }

        return Ok(new { message = $"'{username}' is now {dto.Role}." });
    }

    // PUT api/admin/users/{username}/profile
    [HttpPut("users/{username}/profile")]
    public IActionResult UpdateUserProfile(string username, [FromBody] AdminUpdateUserDTO dto)
    {
        var user = _users.Find(username);

        if (user is null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "User not found.");
        }

        _users.UpdateProfile(
            username,
            dto.FullName.Trim(),
            dto.Email.Trim(),
            dto.PhoneNumber.Trim(),
            dto.DateOfBirth.Trim(),
            dto.Gender.Trim());

        if (!string.IsNullOrWhiteSpace(dto.NewPassword))
        {
            _users.SetPassword(username, dto.NewPassword);
        }

        return Ok(new { message = $"Information for '{username}' updated." });
    }

    // ================================================================
    // ---------- Popular Recipe management ----------
    // ================================================================

    // GET api/admin/recipes
    [HttpGet("recipes")]
    public async Task<IActionResult> GetRecipes()
    {
        var recipes = await _db.Recipes
            .OrderByDescending(r => r.Id)
            .ToListAsync();

        var recipeIds = recipes.Select(r => r.Id).ToList();
        var categoryAssignments = await _db.RecipeCategoryAssignments
            .Where(rca => recipeIds.Contains(rca.RecipeId))
            .Include(rca => rca.RecipeCategory)
            .ToListAsync();

        var result = recipes.Select(r => new
        {
            r.Id,
            r.UserId,
            r.Title,
            r.Ingredients,
            r.Steps,
            r.Category,
            r.ImageUrl,
            r.OwnerName,
            Categories = categoryAssignments
                .Where(ca => ca.RecipeId == r.Id)
                .Select(ca => new { ca.RecipeCategory.Id, ca.RecipeCategory.Name, ca.RecipeCategory.Emoji, ca.RecipeCategory.ColorKey })
                .ToList()
        });

        return Ok(result);
    }

    // POST api/admin/recipes
    [HttpPost("recipes")]
    public async Task<IActionResult> CreateRecipe([FromBody] AdminRecipeDTO dto)
    {
        var recipe = new Recipe
        {
            UserId = 1,
            Title = dto.Title.Trim(),
            Ingredients = dto.Ingredients.Trim(),
            Steps = dto.Steps.Trim(),
            Category = dto.Category.Trim(),
            ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? "" : dto.ImageUrl.Trim(),
            OwnerName = string.IsNullOrWhiteSpace(dto.OwnerName)
                ? "AI-Generated"
                : dto.OwnerName.Trim()
        };

        _db.Recipes.Add(recipe);
        await _db.SaveChangesAsync();

        await SyncRecipeCategoryAssignments(recipe);

        return Ok(new
        {
            message = $"Recipe '{recipe.Title}' created.",
            recipe.Id
        });
    }

    // PUT api/admin/recipes/{id}
    [HttpPut("recipes/{id:int}")]
    public async Task<IActionResult> UpdateRecipe(int id, [FromBody] AdminRecipeDTO dto)
    {
        var recipe = await _db.Recipes.FindAsync(id);

        if (recipe is null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Recipe not found.");
        }

        recipe.Title = dto.Title.Trim();
        recipe.Ingredients = dto.Ingredients.Trim();
        recipe.Steps = dto.Steps.Trim();
        recipe.Category = dto.Category.Trim();
        recipe.ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? "" : dto.ImageUrl.Trim();
        recipe.OwnerName = string.IsNullOrWhiteSpace(dto.OwnerName)
            ? recipe.OwnerName
            : dto.OwnerName.Trim();

        await _db.SaveChangesAsync();

        await SyncRecipeCategoryAssignments(recipe);

        return Ok(new { message = $"Recipe '{recipe.Title}' updated." });
    }

    // DELETE api/admin/recipes/{id}
    [HttpDelete("recipes/{id:int}")]
    public async Task<IActionResult> DeleteRecipe(int id)
    {
        var recipe = await _db.Recipes.FindAsync(id);

        if (recipe is null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Recipe not found.");
        }

        var inUse = await _db.MealPlans.AnyAsync(m => m.RecipeId == id);

        if (inUse)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "This recipe is used in a meal plan and cannot be removed.");
        }

        var categoryAssignments = _db.RecipeCategoryAssignments
            .Where(a => a.RecipeId == id);

        var favorites = _db.FavoriteRecipes
            .Where(f => f.RecipeId == id);

        _db.RecipeCategoryAssignments.RemoveRange(categoryAssignments);
        _db.FavoriteRecipes.RemoveRange(favorites);
        _db.Recipes.Remove(recipe);

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Recipe '{recipe.Title}' deleted." });
    }

    // ================================================================
    // ---------- Top Recipe Categories management ----------
    // ================================================================

    // GET api/admin/categories
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _db.RecipeCategories
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .ToListAsync();

        return Ok(categories);
    }

    // POST api/admin/categories
    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] AdminCategoryDTO dto)
    {
        var name = dto.Name.Trim();
        var nameLower = name.ToLower();

        var alreadyExists = await _db.RecipeCategories
            .AnyAsync(c => c.Name.ToLower() == nameLower);

        if (alreadyExists)
        {
            return ErrorResponse(
                StatusCodes.Status409Conflict,
                $"Category '{name}' already exists.");
        }

        var category = new RecipeCategory
        {
            Name = name,
            Emoji = string.IsNullOrWhiteSpace(dto.Emoji) ? "🍽️" : dto.Emoji.Trim(),
            ColorKey = string.IsNullOrWhiteSpace(dto.ColorKey) ? "amber" : dto.ColorKey.Trim(),
            SortOrder = dto.SortOrder
        };

        _db.RecipeCategories.Add(category);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Category '{category.Name}' created.",
            category.Id
        });
    }

    // PUT api/admin/categories/{id}
    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] AdminCategoryDTO dto)
    {
        var category = await _db.RecipeCategories.FindAsync(id);

        if (category is null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Category not found.");
        }

        var name = dto.Name.Trim();
        var nameLower = name.ToLower();

        var duplicateName = await _db.RecipeCategories
            .AnyAsync(c => c.Id != id && c.Name.ToLower() == nameLower);

        if (duplicateName)
        {
            return ErrorResponse(
                StatusCodes.Status409Conflict,
                $"Category '{name}' already exists.");
        }

        category.Name = name;
        category.Emoji = string.IsNullOrWhiteSpace(dto.Emoji) ? "🍽️" : dto.Emoji.Trim();
        category.ColorKey = string.IsNullOrWhiteSpace(dto.ColorKey) ? "amber" : dto.ColorKey.Trim();
        category.SortOrder = dto.SortOrder;

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Category '{category.Name}' updated." });
    }

    // DELETE api/admin/categories/{id}
    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _db.RecipeCategories.FindAsync(id);

        if (category is null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Category not found.");
        }

        var assignments = _db.RecipeCategoryAssignments
            .Where(a => a.RecipeCategoryId == id);

        _db.RecipeCategoryAssignments.RemoveRange(assignments);
        _db.RecipeCategories.Remove(category);

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Category '{category.Name}' deleted." });
    }

    // GET api/admin/users/{username}/overview
    [HttpGet("users/{username}/overview")]
    public async Task<IActionResult> GetUserOverview(string username)
    {
        var user = _users.Find(username);

        if (user is null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "User not found.");
        }

        var userId = UserIdResolver.GetUserId(username);
        var weekStart = WeekDateHelper.CurrentMonday();

        var recipeCount = await _db.Recipes.CountAsync(r =>
            r.OwnerName == user.FullName || r.UserId == userId);

        var favoriteCount = await _db.FavoriteRecipes.CountAsync(f =>
            f.Username == username);

        var pantryCount = await _db.Pantries.CountAsync(p =>
            p.UserId == userId);

        var mealPlanCount = await _db.MealPlans.CountAsync(m =>
            m.UserId == userId && m.WeekStartDate == weekStart);

        var recentRecipes = await _db.Recipes
            .Where(r => r.OwnerName == user.FullName || r.UserId == userId)
            .OrderByDescending(r => r.Id)
            .Take(5)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.Category,
                r.ImageUrl
            })
            .ToListAsync();

        var favorites = await _db.FavoriteRecipes
            .Where(f => f.Username == username)
            .Include(f => f.Recipe)
            .OrderByDescending(f => f.CreatedAt)
            .Take(5)
            .Select(f => new
            {
                f.RecipeId,
                f.Recipe.Title,
                f.Recipe.Category
            })
            .ToListAsync();

        var currentWeekPlan = await _db.MealPlans
            .Where(m => m.UserId == userId && m.WeekStartDate == weekStart)
            .Include(m => m.Recipe)
            .Select(m => new
            {
                m.Day,
                m.MealSlot,
                RecipeTitle = m.Recipe.Title
            })
            .ToListAsync();

        return Ok(new
        {
            user = new
            {
                user.Username,
                user.FullName,
                user.Email,
                user.Role,
                user.IsActive,
                user.CreatedAt
            },
            userId,
            stats = new
            {
                recipeCount,
                favoriteCount,
                pantryCount,
                mealPlanCount,
                currentWeekLabel = WeekDateHelper.FormatLabel(weekStart)
            },
            recentRecipes,
            favorites,
            currentWeekPlan
        });
    }

    private async Task SyncRecipeCategoryAssignments(Recipe recipe)
    {
        var existing = await _db.RecipeCategoryAssignments
            .Where(a => a.RecipeId == recipe.Id)
            .ToListAsync();

        if (existing.Count > 0)
        {
            _db.RecipeCategoryAssignments.RemoveRange(existing);
        }

        if (!string.IsNullOrWhiteSpace(recipe.Category))
        {
            var categoryId = await _db.RecipeCategories
                .Where(c => c.Name == recipe.Category)
                .Select(c => (int?)c.Id)
                .FirstOrDefaultAsync();

            if (categoryId.HasValue)
            {
                _db.RecipeCategoryAssignments.Add(new RecipeCategoryAssignment
                {
                    RecipeId = recipe.Id,
                    RecipeCategoryId = categoryId.Value
                });
            }
        }

        await _db.SaveChangesAsync();
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
}