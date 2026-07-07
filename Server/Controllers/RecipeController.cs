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
                Title = r.Title,
                Ingredients = r.Ingredients,
                Steps = r.Steps,
                Category = r.Category,
                ImageUrl = r.ImageUrl
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
            Title = recipe.Title,
            Ingredients = recipe.Ingredients,
            Steps = recipe.Steps,
            Category = recipe.Category,
            ImageUrl = recipe.ImageUrl
        });
    }

    // POST: /api/recipe
    [HttpPost]
    public async Task<ActionResult<RecipeDTO>> CreateRecipe(CreateRecipeDTO dto)
    {
        var recipe = new Recipe
        {
            UserId = dto.UserId,
            Title = dto.Title,
            Ingredients = dto.Ingredients,
            Steps = dto.Steps,
            Category = dto.Category,
            ImageUrl = dto.ImageUrl
        };

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();

        var recipeDto = new RecipeDTO
        {
            Id = recipe.Id,
            UserId = recipe.UserId,
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
}