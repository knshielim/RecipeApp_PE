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

    // PUT api/admin/users/{username}/status -- activate / deactivate an account.
    // A deactivated user cannot log in (enforced in AuthController.Login).
    [HttpPut("users/{username}/status")]
    public IActionResult UpdateStatus(string username, [FromBody] UpdateUserStatusDTO dto)
    {
        var me = User.Identity?.Name;
        if (string.Equals(me, username, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "You cannot deactivate your own account." });

        if (!_users.SetActive(username, dto.IsActive))
            return NotFound(new { message = "User not found." });

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
            return BadRequest(new { message = "You cannot delete your own account." });

        if (!_users.Remove(username))
            return NotFound(new { message = "User not found." });

        return Ok(new { message = $"User '{username}' deleted." });
    }

    // PUT api/admin/users/{username}/role
    [HttpPut("users/{username}/role")]
    public IActionResult UpdateRole(string username, [FromBody] UpdateRoleDTO dto)
    {
        if (dto.Role != "Admin" && dto.Role != "User")
            return BadRequest(new { message = "Role must be 'Admin' or 'User'." });

        var me = User.Identity?.Name;
        if (string.Equals(me, username, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "You cannot change your own role." });

        if (!_users.UpdateRole(username, dto.Role))
            return NotFound(new { message = "User not found." });

        return Ok(new { message = $"'{username}' is now {dto.Role}." });
    }

    // PUT api/admin/users/{username}/profile -- admin edits any user's information
    [HttpPut("users/{username}/profile")]
    public IActionResult UpdateUserProfile(string username, [FromBody] AdminUpdateUserDTO dto)
    {
        var user = _users.Find(username);
        if (user is null)
            return NotFound(new { message = "User not found." });

        if (string.IsNullOrWhiteSpace(dto.FullName))
            return BadRequest(new { message = "Full name is required." });

        if (string.IsNullOrWhiteSpace(dto.Email) || !dto.Email.Contains('@'))
            return BadRequest(new { message = "A valid email is required." });

        if (!string.IsNullOrWhiteSpace(dto.NewPassword) && dto.NewPassword.Length < 6)
            return BadRequest(new { message = "New password must be at least 6 characters." });

        _users.UpdateProfile(
            username,
            dto.FullName.Trim(),
            dto.Email.Trim(),
            dto.PhoneNumber.Trim(),
            dto.DateOfBirth.Trim(),
            dto.Gender.Trim());

        if (!string.IsNullOrWhiteSpace(dto.NewPassword))
            _users.SetPassword(username, dto.NewPassword);

        return Ok(new { message = $"Information for '{username}' updated." });
    }

    // ================================================================
    // ---------- Popular Recipe management (mirrors the user dashboard) ----------
    // ================================================================

    // GET api/admin/recipes
    [HttpGet("recipes")]
    public async Task<IActionResult> GetRecipes()
    {
        var recipes = await _db.Recipes
            .OrderByDescending(r => r.Id)
            .Select(r => new { r.Id, r.UserId, r.Title, r.Ingredients, r.Category, r.ImageUrl })
            .ToListAsync();

        return Ok(recipes);
    }

    // POST api/admin/recipes -- create a new "Popular Recipe" entry
    [HttpPost("recipes")]
    public async Task<IActionResult> CreateRecipe([FromBody] AdminRecipeDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Title is required." });
        if (string.IsNullOrWhiteSpace(dto.Ingredients))
            return BadRequest(new { message = "Ingredients are required." });
        if (string.IsNullOrWhiteSpace(dto.Category))
            return BadRequest(new { message = "Category is required." });

        var recipe = new Recipe
        {
            UserId = 1, // shared demo dataset used by the user dashboard
            Title = dto.Title.Trim(),
            Ingredients = dto.Ingredients.Trim(),
            Category = dto.Category.Trim(),
            ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? "" : dto.ImageUrl.Trim()
        };

        _db.Recipes.Add(recipe);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Recipe '{recipe.Title}' created.", recipe.Id });
    }

    // PUT api/admin/recipes/{id} -- edit an existing "Popular Recipe" entry
    [HttpPut("recipes/{id:int}")]
    public async Task<IActionResult> UpdateRecipe(int id, [FromBody] AdminRecipeDTO dto)
    {
        var recipe = await _db.Recipes.FindAsync(id);
        if (recipe is null)
            return NotFound(new { message = "Recipe not found." });

        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Title is required." });
        if (string.IsNullOrWhiteSpace(dto.Ingredients))
            return BadRequest(new { message = "Ingredients are required." });
        if (string.IsNullOrWhiteSpace(dto.Category))
            return BadRequest(new { message = "Category is required." });

        recipe.Title = dto.Title.Trim();
        recipe.Ingredients = dto.Ingredients.Trim();
        recipe.Category = dto.Category.Trim();
        recipe.ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? "" : dto.ImageUrl.Trim();

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Recipe '{recipe.Title}' updated." });
    }

    // DELETE api/admin/recipes/{id}
    [HttpDelete("recipes/{id:int}")]
    public async Task<IActionResult> DeleteRecipe(int id)
    {
        var recipe = await _db.Recipes.FindAsync(id);
        if (recipe is null)
            return NotFound(new { message = "Recipe not found." });

        var inUse = await _db.MealPlans.AnyAsync(m => m.RecipeId == id);
        if (inUse)
            return BadRequest(new { message = "This recipe is used in a meal plan and cannot be removed." });

        _db.Recipes.Remove(recipe);
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Recipe '{recipe.Title}' deleted." });
    }

    // ================================================================
    // ---------- Top Recipe Categories management (mirrors the user dashboard) ----------
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

    // POST api/admin/categories -- create a new "Top Recipe Category" tile
    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] AdminCategoryDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Name is required." });

        var category = new RecipeCategory
        {
            Name = dto.Name.Trim(),
            Emoji = string.IsNullOrWhiteSpace(dto.Emoji) ? "🍽️" : dto.Emoji.Trim(),
            ColorKey = string.IsNullOrWhiteSpace(dto.ColorKey) ? "amber" : dto.ColorKey.Trim(),
            SortOrder = dto.SortOrder
        };

        _db.RecipeCategories.Add(category);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Category '{category.Name}' created.", category.Id });
    }

    // PUT api/admin/categories/{id} -- edit a "Top Recipe Category" tile
    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] AdminCategoryDTO dto)
    {
        var category = await _db.RecipeCategories.FindAsync(id);
        if (category is null)
            return NotFound(new { message = "Category not found." });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Name is required." });

        category.Name = dto.Name.Trim();
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
            return NotFound(new { message = "Category not found." });

        _db.RecipeCategories.Remove(category);
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Category '{category.Name}' deleted." });
    }

    // GET api/admin/users/{username}/overview — activity summary for a user account
    [HttpGet("users/{username}/overview")]
    public async Task<IActionResult> GetUserOverview(string username)
    {
        var user = _users.Find(username);
        if (user is null)
            return NotFound(new { message = "User not found." });

        var userId = UserIdResolver.GetUserId(username);
        var weekStart = WeekDateHelper.CurrentMonday();

        var recipeCount = await _db.Recipes.CountAsync(r =>
            r.OwnerName == user.FullName || r.UserId == userId);
        var favoriteCount = await _db.FavoriteRecipes.CountAsync(f => f.Username == username);
        var pantryCount = await _db.Pantries.CountAsync(p => p.UserId == userId);
        var mealPlanCount = await _db.MealPlans.CountAsync(m =>
            m.UserId == userId && m.WeekStartDate == weekStart);

        var recentRecipes = await _db.Recipes
            .Where(r => r.OwnerName == user.FullName || r.UserId == userId)
            .OrderByDescending(r => r.Id)
            .Take(5)
            .Select(r => new { r.Id, r.Title, r.Category, r.ImageUrl })
            .ToListAsync();

        var favorites = await _db.FavoriteRecipes
            .Where(f => f.Username == username)
            .Include(f => f.Recipe)
            .OrderByDescending(f => f.CreatedAt)
            .Take(5)
            .Select(f => new { f.RecipeId, f.Recipe.Title, f.Recipe.Category })
            .ToListAsync();

        var currentWeekPlan = await _db.MealPlans
            .Where(m => m.UserId == userId && m.WeekStartDate == weekStart)
            .Include(m => m.Recipe)
            .Select(m => new { m.Day, m.MealSlot, RecipeTitle = m.Recipe.Title })
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
}
