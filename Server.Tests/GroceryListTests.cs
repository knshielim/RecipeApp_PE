using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Server.Tests;

public class GroceryListTests
{
    private static async Task<JsonElement> GetList(AppDbContext db, int userId)
    {
        var controller = TestHelpers.NewController(db);
        var result = Assert.IsType<OkObjectResult>(await controller.GetGroceryList(userId));
        var json = JsonSerializer.Serialize(result.Value);
        return JsonDocument.Parse(json).RootElement;
    }

    private static JsonElement FindItem(JsonElement root, string name)
    {
        foreach (var item in root.GetProperty("items").EnumerateArray())
        {
            if (item.GetProperty("name").GetString() == name) return item;
        }
        throw new Xunit.Sdk.XunitException($"Item '{name}' not found in grocery list.");
    }

    [Fact]
    public async Task EmptyPlan_ReturnsEmptyList()
    {
        using var db = TestHelpers.NewDb();

        var root = await GetList(db, 1);

        Assert.Equal(0, root.GetProperty("totalRecipes").GetInt32());
        Assert.Empty(root.GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task PlainIngredients_DuplicatesAcrossRecipes_CountOccurrences()
    {
        using var db = TestHelpers.NewDb();
        var stirFry = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice, broccoli");
        var friedRice = TestHelpers.AddRecipe(db, 1, "Fried Rice", "rice, egg");
        db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Monday", MealSlot = "dinner", RecipeId = stirFry.Id });
        db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Tuesday", MealSlot = "dinner", RecipeId = friedRice.Id });
        db.SaveChanges();

        var root = await GetList(db, 1);

        Assert.Equal(2, root.GetProperty("totalRecipes").GetInt32());
        Assert.Equal(2, FindItem(root, "rice").GetProperty("occurrences").GetInt32());
        Assert.Equal(1, FindItem(root, "chicken").GetProperty("occurrences").GetInt32());
    }

    [Fact]
    public async Task SameRecipePlannedTwice_IngredientsCountedTwice()
    {
        using var db = TestHelpers.NewDb();
        var stirFry = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Monday", MealSlot = "dinner", RecipeId = stirFry.Id });
        db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Wednesday", MealSlot = "lunch", RecipeId = stirFry.Id });
        db.SaveChanges();

        var root = await GetList(db, 1);

        Assert.Equal(2, FindItem(root, "chicken").GetProperty("occurrences").GetInt32());
    }

    [Fact]
    public async Task QuantifiedIngredients_SameUnit_QuantitiesAreSummed()
    {
        using var db = TestHelpers.NewDb();
        var a = TestHelpers.AddRecipe(db, 1, "Rice Bowl", "200 g rice, 2 eggs");
        var b = TestHelpers.AddRecipe(db, 1, "Rice Plate", "300 g rice");
        db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Monday", MealSlot = "lunch", RecipeId = a.Id });
        db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Tuesday", MealSlot = "lunch", RecipeId = b.Id });
        db.SaveChanges();

        var root = await GetList(db, 1);

        var rice = FindItem(root, "rice");
        Assert.Equal(500, rice.GetProperty("quantity").GetDouble());
        Assert.Equal("g", rice.GetProperty("unit").GetString());
    }

    [Fact]
    public async Task QuantifiedIngredients_DifferentUnits_KeptAsSeparateItems()
    {
        using var db = TestHelpers.NewDb();
        var a = TestHelpers.AddRecipe(db, 1, "Soup", "200 g rice");
        var b = TestHelpers.AddRecipe(db, 1, "Side", "1 cup rice");
        db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Monday", MealSlot = "lunch", RecipeId = a.Id });
        db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Tuesday", MealSlot = "lunch", RecipeId = b.Id });
        db.SaveChanges();

        var root = await GetList(db, 1);

        var riceEntries = root.GetProperty("items").EnumerateArray()
            .Where(i => i.GetProperty("name").GetString() == "rice")
            .ToList();
        Assert.Equal(2, riceEntries.Count);
    }

    [Fact]
    public async Task OtherUsersPlans_AreExcluded()
    {
        using var db = TestHelpers.NewDb();
        var theirs = TestHelpers.AddRecipe(db, 2, "Their Meal", "tofu");
        db.MealPlans.Add(new MealPlan { UserId = 2, Day = "Monday", MealSlot = "dinner", RecipeId = theirs.Id });
        db.SaveChanges();

        var root = await GetList(db, 1);

        Assert.Empty(root.GetProperty("items").EnumerateArray());
    }
}
