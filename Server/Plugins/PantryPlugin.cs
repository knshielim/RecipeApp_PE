using System.ComponentModel;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
 
public class PantryPlugin
{
    private readonly AppDbContext _db;
    public PantryPlugin(AppDbContext db) => _db = db;
 
    [KernelFunction("get_pantry_items")]
    [Description("Gets all ingredients currently available in the user's pantry")]
    public async Task<string> GetPantryItemsAsync(
        [Description("The user's id")] int userId)
    {
        var items = await _db.Pantries
            .Where(p => p.UserId == userId)
            .Select(p => new { p.IngredientName, p.Quantity, p.Unit, p.Category })
            .ToListAsync();
 
        if (items.Count == 0)
            return "The user's pantry is empty.";
 
        return string.Join("\n", items.Select(i =>
            $"- {i.IngredientName}: {i.Quantity}{(string.IsNullOrWhiteSpace(i.Unit) ? "" : " " + i.Unit)} ({i.Category})"));
    }
}
 