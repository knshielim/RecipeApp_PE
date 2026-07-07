using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.DTO;
using Server.Models;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RecipeController : ControllerBase
{
    private readonly AppDbContext _context;

    public RecipeController(AppDbContext context)
    {
        _context = context;
    }

    // GET: /api/recipe
    // Optional: /api/recipe?search=chicken&category=Asian
    [HttpGet]
    public async Task<IActionResult> GetRecipes(
        [FromQuery] string? search,
        [FromQuery] string? category)
    {
        var query = _context.Recipes.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();

            query = query.Where(r =>
                r.Title.ToLower().Contains(term) ||
                r.Ingredients.ToLower().Contains(term) ||
                r.Category.ToLower().Contains(term) ||
                r.OwnerName.ToLower().Contains(term) ||
                r.CategoryAssignments.Any(ca =>
                    ca.RecipeCategory.Name.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var categoryTerm = category.Trim().ToLower();

            query = query.Where(r =>
                r.Category.ToLower() == categoryTerm ||
                r.CategoryAssignments.Any(ca =>
                    ca.RecipeCategory.Name.ToLower() == categoryTerm));
        }

        var recipes = await query
            .OrderBy(r => r.Title)
            .ToListAsync();

        var recipeIds = recipes.Select(r => r.Id).ToList();

        var categoryAssignments = await _context.RecipeCategoryAssignments
            .Where(rca => recipeIds.Contains(rca.RecipeId))
            .Include(rca => rca.RecipeCategory)
            .ToListAsync();

        var result = recipes
            .Select(r => ToRecipeDto(r, categoryAssignments))
            .ToList();

        return Ok(result);
    }

    // GET: /api/recipe/1
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetRecipe(int id)
    {
        if (id <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Recipe ID must be valid.");
        }

        var recipe = await _context.Recipes.FindAsync(id);

        if (recipe == null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Recipe not found.");
        }

        var categoryAssignments = await _context.RecipeCategoryAssignments
            .Where(rca => rca.RecipeId == id)
            .Include(rca => rca.RecipeCategory)
            .ToListAsync();

        return Ok(ToRecipeDto(recipe, categoryAssignments));
    }

    // POST: /api/recipe
    [HttpPost]
    public async Task<IActionResult> CreateRecipe([FromBody] CreateRecipeDTO dto)
    {
        var categoryError = await ValidateCategoryIds(dto.CategoryIds);
        if (categoryError != null)
        {
            return categoryError;
        }

        var recipe = new Recipe
        {
            UserId = dto.UserId,
            OwnerName = dto.OwnerName.Trim(),
            DietRestriction = string.IsNullOrWhiteSpace(dto.DietRestriction)
                ? "none"
                : dto.DietRestriction.Trim(),
            Allergens = string.IsNullOrWhiteSpace(dto.Allergens)
                ? ""
                : dto.Allergens.Trim(),
            Title = dto.Title.Trim(),
            Ingredients = dto.Ingredients.Trim(),
            Steps = dto.Steps.Trim(),
            Category = dto.Category.Trim(),
            ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl)
                ? ""
                : dto.ImageUrl.Trim()
        };

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();

        await SyncCategoryAssignmentsAsync(recipe.Id, dto.CategoryIds, recipe.Category);

        var categoryAssignments = await _context.RecipeCategoryAssignments
            .Where(rca => rca.RecipeId == recipe.Id)
            .Include(rca => rca.RecipeCategory)
            .ToListAsync();

        var recipeDto = ToRecipeDto(recipe, categoryAssignments);

        return CreatedAtAction(
            nameof(GetRecipe),
            new { id = recipe.Id },
            recipeDto);
    }

    // PUT: /api/recipe/1
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateRecipe(int id, [FromBody] UpdateRecipeDTO dto)
    {
        if (id <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Recipe ID must be valid.");
        }

        var recipe = await _context.Recipes.FindAsync(id);

        if (recipe == null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Recipe not found.");
        }

        var categoryError = await ValidateCategoryIds(dto.CategoryIds);
        if (categoryError != null)
        {
            return categoryError;
        }

        recipe.Title = dto.Title.Trim();
        recipe.Ingredients = dto.Ingredients.Trim();
        recipe.Steps = dto.Steps.Trim();
        recipe.Category = dto.Category.Trim();
        recipe.DietRestriction = string.IsNullOrWhiteSpace(dto.DietRestriction)
            ? recipe.DietRestriction
            : dto.DietRestriction.Trim();
        recipe.Allergens = string.IsNullOrWhiteSpace(dto.Allergens)
            ? ""
            : dto.Allergens.Trim();
        recipe.ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl)
            ? ""
            : dto.ImageUrl.Trim();

        await _context.SaveChangesAsync();

        await SyncCategoryAssignmentsAsync(recipe.Id, dto.CategoryIds, recipe.Category);

        return Ok(new
        {
            message = $"Recipe '{recipe.Title}' updated.",
            recipe.Id
        });
    }

    // DELETE: /api/recipe/1
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteRecipe(int id)
    {
        if (id <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Recipe ID must be valid.");
        }

        var recipe = await _context.Recipes.FindAsync(id);

        if (recipe == null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Recipe not found.");
        }

        var inUse = await _context.MealPlans.AnyAsync(m => m.RecipeId == id);

        if (inUse)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "This recipe is used in a meal plan and cannot be removed.");
        }

        var categoryAssignments = _context.RecipeCategoryAssignments
            .Where(rca => rca.RecipeId == id);

        var favorites = _context.FavoriteRecipes
            .Where(f => f.RecipeId == id);

        _context.RecipeCategoryAssignments.RemoveRange(categoryAssignments);
        _context.FavoriteRecipes.RemoveRange(favorites);
        _context.Recipes.Remove(recipe);

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Recipe '{recipe.Title}' deleted." });
    }

    // GET: /api/recipe/favorites?username=alice
    [HttpGet("favorites")]
    public async Task<IActionResult> GetFavoriteRecipes([FromQuery] string? username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Username is required.");
        }

        var recipes = await _context.FavoriteRecipes
            .Where(f => f.Username == username.Trim())
            .Select(f => f.Recipe)
            .ToListAsync();

        var recipeIds = recipes.Select(r => r.Id).ToList();

        var categoryAssignments = await _context.RecipeCategoryAssignments
            .Where(rca => recipeIds.Contains(rca.RecipeId))
            .Include(rca => rca.RecipeCategory)
            .ToListAsync();

        var result = recipes
            .Select(r => ToRecipeDto(r, categoryAssignments, isFavorite: true))
            .ToList();

        return Ok(result);
    }

    // POST: /api/recipe/1/favorite?username=alice
    [HttpPost("{id:int}/favorite")]
    public async Task<IActionResult> AddFavorite(int id, [FromQuery] string? username)
    {
        if (id <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Recipe ID must be valid.");
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Username is required.");
        }

        var normalizedUsername = username.Trim();

        var recipeExists = await _context.Recipes.AnyAsync(r => r.Id == id);

        if (!recipeExists)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Recipe not found.");
        }

        var alreadyFavorite = await _context.FavoriteRecipes
            .AnyAsync(f => f.RecipeId == id && f.Username == normalizedUsername);

        if (alreadyFavorite)
        {
            return Ok(new { message = "Recipe already in favorites." });
        }

        var favorite = new FavoriteRecipe
        {
            RecipeId = id,
            Username = normalizedUsername
        };

        _context.FavoriteRecipes.Add(favorite);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Recipe added to favorites." });
    }

    // DELETE: /api/recipe/1/favorite?username=alice
    [HttpDelete("{id:int}/favorite")]
    public async Task<IActionResult> RemoveFavorite(int id, [FromQuery] string? username)
    {
        if (id <= 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Recipe ID must be valid.");
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                "Username is required.");
        }

        var normalizedUsername = username.Trim();

        var favorite = await _context.FavoriteRecipes
            .FirstOrDefaultAsync(f =>
                f.RecipeId == id &&
                f.Username == normalizedUsername);

        if (favorite == null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "Favorite recipe not found.");
        }

        _context.FavoriteRecipes.Remove(favorite);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Recipe removed from favorites." });
    }

    private async Task<IActionResult?> ValidateCategoryIds(List<int>? categoryIds)
    {
        if (categoryIds == null || categoryIds.Count == 0)
        {
            return null;
        }

        var uniqueCategoryIds = categoryIds
            .Distinct()
            .ToList();

        var existingCategoryIds = await _context.RecipeCategories
            .Where(c => uniqueCategoryIds.Contains(c.Id))
            .Select(c => c.Id)
            .ToListAsync();

        var invalidCategoryIds = uniqueCategoryIds
            .Except(existingCategoryIds)
            .ToList();

        if (invalidCategoryIds.Count > 0)
        {
            return ErrorResponse(
                StatusCodes.Status400BadRequest,
                $"Invalid category ID(s): {string.Join(", ", invalidCategoryIds)}.");
        }

        return null;
    }

    private async Task SyncCategoryAssignmentsAsync(
        int recipeId,
        List<int>? categoryIds,
        string categoryName)
    {
        var existingAssignments = await _context.RecipeCategoryAssignments
            .Where(rca => rca.RecipeId == recipeId)
            .ToListAsync();

        if (existingAssignments.Count > 0)
        {
            _context.RecipeCategoryAssignments.RemoveRange(existingAssignments);
        }

        if (categoryIds != null && categoryIds.Count > 0)
        {
            foreach (var categoryId in categoryIds.Distinct())
            {
                _context.RecipeCategoryAssignments.Add(new RecipeCategoryAssignment
                {
                    RecipeId = recipeId,
                    RecipeCategoryId = categoryId
                });
            }
        }
        else if (!string.IsNullOrWhiteSpace(categoryName))
        {
            var categoryId = await _context.RecipeCategories
                .Where(c => c.Name == categoryName)
                .Select(c => (int?)c.Id)
                .FirstOrDefaultAsync();

            if (categoryId.HasValue)
            {
                _context.RecipeCategoryAssignments.Add(new RecipeCategoryAssignment
                {
                    RecipeId = recipeId,
                    RecipeCategoryId = categoryId.Value
                });
            }
        }

        await _context.SaveChangesAsync();
    }

    private static RecipeDTO ToRecipeDto(
        Recipe recipe,
        IEnumerable<RecipeCategoryAssignment> categoryAssignments,
        bool isFavorite = false)
    {
        return new RecipeDTO
        {
            Id = recipe.Id,
            UserId = recipe.UserId,
            OwnerName = recipe.OwnerName,
            DietRestriction = recipe.DietRestriction,
            Allergens = recipe.Allergens,
            Title = recipe.Title,
            Ingredients = recipe.Ingredients,
            Steps = recipe.Steps,
            Category = recipe.Category,
            ImageUrl = recipe.ImageUrl,
            IsFavorite = isFavorite,
            Categories = categoryAssignments
                .Where(ca => ca.RecipeId == recipe.Id)
                .Select(ca => new CategoryDTO
                {
                    Id = ca.RecipeCategory.Id,
                    Name = ca.RecipeCategory.Name,
                    Emoji = ca.RecipeCategory.Emoji,
                    ColorKey = ca.RecipeCategory.ColorKey
                })
                .ToList()
        };
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