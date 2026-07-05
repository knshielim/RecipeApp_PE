using Microsoft.EntityFrameworkCore;
using Server.Services;
using ServerApi.Controllers;

namespace Server.Tests;

// Fake AI boundary: returns whatever suggestions the test configures,
// so no real AI call is ever made.
public class FakeSuggester : IMealPlanSuggester
{
    public List<MealSlotSuggestion> Suggestions { get; set; } = new();
    public bool WasCalled { get; private set; }

    public Task<List<MealSlotSuggestion>> SuggestWeekAsync(List<Recipe> recipes, UserPreference? prefs)
    {
        WasCalled = true;
        return Task.FromResult(Suggestions);
    }
}

public static class TestHelpers
{
    public static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    public static MealPlanController NewController(AppDbContext db, FakeSuggester? suggester = null)
        => new(db, suggester ?? new FakeSuggester());

    public static Recipe AddRecipe(AppDbContext db, int userId, string title, string ingredients, string category = "Dinner")
    {
        var recipe = new Recipe { UserId = userId, Title = title, Ingredients = ingredients, Category = category };
        db.Recipes.Add(recipe);
        db.SaveChanges();
        return recipe;
    }
}
