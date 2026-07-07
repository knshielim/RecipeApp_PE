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
    // Optional: /api/recipe?search=chicken&category=Dinner
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RecipeDTO>>> GetRecipes(
        [FromQuery] string? search,
        [FromQuery] string? category)
    {
        var query = _context.Recipes.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(r =>
                r.Title.Contains(search) ||
                r.Ingredients.Contains(search) ||
                r.Category.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(r => r.Category == category);
        }

        var recipes = await query
            .OrderBy(r => r.Title)
            .Select(r => new RecipeDTO
            {
                Id = r.Id,
                UserId = r.UserId,
                OwnerName = r.OwnerName,
                DietRestriction = r.DietRestriction,
                Title = r.Title,
                Ingredients = r.Ingredients,
                Steps = r.Steps,
                Category = r.Category,
                ImageUrl = r.ImageUrl,
            })
            .ToListAsync();

        return Ok(recipes);
    }

    // GET: /api/recipe/1
    [HttpGet("{id}")]
    public async Task<ActionResult<RecipeDTO>> GetRecipe(int id)
    {
        var recipe = await _context.Recipes.FindAsync(id);

        if (recipe == null)
        {
            return NotFound(new { message = "Recipe not found." });
        }

        return Ok(new RecipeDTO
        {
            Id = recipe.Id,
            UserId = recipe.UserId,
            OwnerName = recipe.OwnerName,
            DietRestriction = recipe.DietRestriction,
            Title = recipe.Title,
            Ingredients = recipe.Ingredients,
            Steps = recipe.Steps,
            Category = recipe.Category,
            ImageUrl = recipe.ImageUrl,
        });
    }

    // POST: /api/recipe
    [HttpPost]
    public async Task<ActionResult<RecipeDTO>> CreateRecipe(CreateRecipeDTO dto)
    {
        var recipe = new Recipe
        {
            UserId = dto.UserId,
            OwnerName = dto.OwnerName.Trim(),
            DietRestriction = string.IsNullOrWhiteSpace(dto.DietRestriction) ? "none" : dto.DietRestriction.Trim(),
            Title = dto.Title,
            Ingredients = dto.Ingredients,
            Steps = dto.Steps,
            Category = dto.Category,
            ImageUrl = dto.ImageUrl,
        };

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();

        var recipeDto = new RecipeDTO
        {
            Id = recipe.Id,
            UserId = recipe.UserId,
            OwnerName = recipe.OwnerName,
            DietRestriction = recipe.DietRestriction,
            Title = recipe.Title,
            Ingredients = recipe.Ingredients,
            Steps = recipe.Steps,
            Category = recipe.Category,
            ImageUrl = recipe.ImageUrl
        };

        return CreatedAtAction(nameof(GetRecipe), new { id = recipe.Id }, recipeDto);
    }

    // PUT: /api/recipe/1
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRecipe(int id, UpdateRecipeDTO dto)
    {
        var recipe = await _context.Recipes.FindAsync(id);

        if (recipe == null)
        {
            return NotFound(new { message = "Recipe not found." });
        }

        recipe.Title = dto.Title;
        recipe.Ingredients = dto.Ingredients;
        recipe.Steps = dto.Steps;
        recipe.Category = dto.Category;
        recipe.DietRestriction = string.IsNullOrWhiteSpace(dto.DietRestriction) ? recipe.DietRestriction : dto.DietRestriction.Trim();
        recipe.ImageUrl = dto.ImageUrl;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // DELETE: /api/recipe/1
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRecipe(int id)
    {
        var recipe = await _context.Recipes.FindAsync(id);

        if (recipe == null)
        {
            return NotFound(new { message = "Recipe not found." });
        }

        _context.Recipes.Remove(recipe);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("favorites")]
    public async Task<ActionResult<IEnumerable<RecipeDTO>>> GetFavoriteRecipes([FromQuery] string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return BadRequest(new { message = "Username is required." });
        }

        var recipes = await _context.FavoriteRecipes
            .Where(f => f.Username == username)
            .Include(f => f.Recipe)
            .Select(f => new RecipeDTO
            {
                Id = f.Recipe.Id,
                UserId = f.Recipe.UserId,
                OwnerName = f.Recipe.OwnerName,
                DietRestriction = f.Recipe.DietRestriction,
                Title = f.Recipe.Title,
                Ingredients = f.Recipe.Ingredients,
                Steps = f.Recipe.Steps,
                Category = f.Recipe.Category,
                ImageUrl = f.Recipe.ImageUrl,
                IsFavorite = true
            })
            .ToListAsync();

        return Ok(recipes);
    }

    [HttpPost("{id}/favorite")]
    public async Task<IActionResult> AddFavorite(int id, [FromQuery] string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return BadRequest(new { message = "Username is required." });
        }

        var recipeExists = await _context.Recipes.AnyAsync(r => r.Id == id);

        if (!recipeExists)
        {
            return NotFound(new { message = "Recipe not found." });
        }

        var alreadyFavorite = await _context.FavoriteRecipes
            .AnyAsync(f => f.RecipeId == id && f.Username == username);

        if (alreadyFavorite)
        {
            return Ok(new { message = "Recipe already in favorites." });
        }

        var favorite = new FavoriteRecipe
        {
            RecipeId = id,
            Username = username
        };

        _context.FavoriteRecipes.Add(favorite);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Recipe added to favorites." });
    }

    [HttpDelete("{id}/favorite")]
    public async Task<IActionResult> RemoveFavorite(int id, [FromQuery] string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return BadRequest(new { message = "Username is required." });
        }

        var favorite = await _context.FavoriteRecipes
            .FirstOrDefaultAsync(f => f.RecipeId == id && f.Username == username);

        if (favorite == null)
        {
            return NotFound(new { message = "Favorite recipe not found." });
        }

        _context.FavoriteRecipes.Remove(favorite);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
