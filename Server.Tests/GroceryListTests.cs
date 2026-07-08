using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Server.DTO;
using Server.Models;
using ServerApi.Controllers;
using Xunit;

namespace Server.Tests;

public class GroceryListTests
{
    private static GroceryListController NewController(AppDbContext db) => new(db);

    private static JsonElement ToJson(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        return JsonDocument.Parse(json).RootElement;
    }

    private static async Task<JsonElement> Generate(AppDbContext db, int userId)
        => ToJson(await NewController(db).Generate(userId));

    private static async Task<JsonElement> GetSaved(AppDbContext db, int userId)
        => ToJson(await NewController(db).Get(userId));

    private static JsonElement FindItem(JsonElement root, string name)
    {
        foreach (var item in root.GetProperty("items").EnumerateArray())
        {
            if (item.GetProperty("name").GetString() == name) return item;
        }
        throw new Xunit.Sdk.XunitException($"Item '{name}' not found in grocery list.");
    }

    private static void PlanMeal(AppDbContext db, int userId, string day, string slot, int recipeId)
    {
        db.MealPlans.Add(new MealPlan
        {
            UserId = userId,
            WeekStartDate = TestHelpers.CurrentWeek,
            Day = day,
            MealSlot = slot,
            RecipeId = recipeId,
        });
        db.SaveChanges();
    }

    // ---- generation / aggregation ----

    [Fact]
    public async Task EmptyPlan_GeneratesEmptyList()
    {
        using var db = TestHelpers.NewDb();

        var root = await Generate(db, 1);

        Assert.Equal(0, root.GetProperty("totalRecipes").GetInt32());
        Assert.Empty(root.GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task PlainIngredients_DuplicatesAcrossRecipes_CountOccurrences()
    {
        using var db = TestHelpers.NewDb();
        var stirFry = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice, broccoli");
        var friedRice = TestHelpers.AddRecipe(db, 1, "Fried Rice", "rice, egg");
        PlanMeal(db, 1, "Monday", "dinner", stirFry.Id);
        PlanMeal(db, 1, "Tuesday", "dinner", friedRice.Id);

        var root = await Generate(db, 1);

        Assert.Equal(2, root.GetProperty("totalRecipes").GetInt32());
        Assert.Equal(2, FindItem(root, "rice").GetProperty("occurrences").GetInt32());
        Assert.Equal(1, FindItem(root, "chicken").GetProperty("occurrences").GetInt32());
    }

    [Fact]
    public async Task QuantifiedIngredients_SameUnit_QuantitiesAreSummed()
    {
        using var db = TestHelpers.NewDb();
        var a = TestHelpers.AddRecipe(db, 1, "Rice Bowl", "200 g rice, 2 eggs");
        var b = TestHelpers.AddRecipe(db, 1, "Rice Plate", "300 g rice");
        PlanMeal(db, 1, "Monday", "lunch", a.Id);
        PlanMeal(db, 1, "Tuesday", "lunch", b.Id);

        var root = await Generate(db, 1);

        var rice = FindItem(root, "rice");
        Assert.Equal(500, rice.GetProperty("quantity").GetDouble());
        Assert.Equal("g", rice.GetProperty("unit").GetString());
    }

    [Fact]
    public async Task PluralAndSingularUnits_AreMerged()
    {
        using var db = TestHelpers.NewDb();
        var a = TestHelpers.AddRecipe(db, 1, "Cake", "1 cup flour");
        var b = TestHelpers.AddRecipe(db, 1, "Bread", "2 cups flour");
        PlanMeal(db, 1, "Monday", "lunch", a.Id);
        PlanMeal(db, 1, "Tuesday", "lunch", b.Id);

        var root = await Generate(db, 1);

        var flour = FindItem(root, "flour");
        Assert.Equal(3, flour.GetProperty("quantity").GetDouble());
        Assert.Equal("cup", flour.GetProperty("unit").GetString());
    }

    [Fact]
    public async Task WeightUnits_AreConvertedAndMerged()
    {
        using var db = TestHelpers.NewDb();
        var a = TestHelpers.AddRecipe(db, 1, "Stew", "500 g beef");
        var b = TestHelpers.AddRecipe(db, 1, "Roast", "1 kg beef");
        PlanMeal(db, 1, "Monday", "dinner", a.Id);
        PlanMeal(db, 1, "Tuesday", "dinner", b.Id);

        var root = await Generate(db, 1);

        var beef = FindItem(root, "beef");
        Assert.Equal(1.5, beef.GetProperty("quantity").GetDouble());
        Assert.Equal("kg", beef.GetProperty("unit").GetString());
    }

    [Fact]
    public async Task PrepNotes_DoNotBecomeItems()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Soup", "1 onion, diced, 2 eggs, beaten, salt");
        PlanMeal(db, 1, "Monday", "dinner", recipe.Id);

        var root = await Generate(db, 1);

        var names = root.GetProperty("items").EnumerateArray()
            .Select(i => i.GetProperty("name").GetString())
            .ToList();

        Assert.Contains("onion", names);
        Assert.Contains("eggs", names);
        Assert.Contains("salt", names);
        Assert.DoesNotContain("diced", names);
        Assert.DoesNotContain("beaten", names);
    }

    [Fact]
    public async Task Fractions_AreParsed()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Cake", "1/2 cup sugar, 1 1/2 cups flour");
        PlanMeal(db, 1, "Monday", "dinner", recipe.Id);

        var root = await Generate(db, 1);

        Assert.Equal(0.5, FindItem(root, "sugar").GetProperty("quantity").GetDouble());
        Assert.Equal(1.5, FindItem(root, "flour").GetProperty("quantity").GetDouble());
    }

    [Fact]
    public async Task DifferentUnits_NotConvertible_KeptAsSeparateItems()
    {
        using var db = TestHelpers.NewDb();
        var a = TestHelpers.AddRecipe(db, 1, "Soup", "200 g rice");
        var b = TestHelpers.AddRecipe(db, 1, "Side", "1 cup rice");
        PlanMeal(db, 1, "Monday", "lunch", a.Id);
        PlanMeal(db, 1, "Tuesday", "lunch", b.Id);

        var root = await Generate(db, 1);

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
        db.MealPlans.Add(new MealPlan { UserId = 2, WeekStartDate = TestHelpers.CurrentWeek, Day = "Monday", MealSlot = "dinner", RecipeId = theirs.Id });
        db.SaveChanges();

        var root = await Generate(db, 1);

        Assert.Empty(root.GetProperty("items").EnumerateArray());
    }

    // ---- persistence ----

    [Fact]
    public async Task Get_BeforeGenerating_ReturnsNullItems()
    {
        using var db = TestHelpers.NewDb();

        var root = await GetSaved(db, 1);

        Assert.Equal(JsonValueKind.Null, root.GetProperty("items").ValueKind);
    }

    [Fact]
    public async Task Generate_SavesList_GetReturnsIt()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        PlanMeal(db, 1, "Monday", "dinner", recipe.Id);

        await Generate(db, 1);
        var root = await GetSaved(db, 1);

        Assert.Equal(2, root.GetProperty("items").GetArrayLength());
        FindItem(root, "chicken");
    }

    [Fact]
    public async Task CheckedState_PersistsAcrossLoads()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken");
        PlanMeal(db, 1, "Monday", "dinner", recipe.Id);

        var generated = await Generate(db, 1);
        var id = FindItem(generated, "chicken").GetProperty("id").GetInt32();

        await NewController(db).UpdateItem(1, id, new GroceryItemUpdateDTO { IsChecked = true });

        var root = await GetSaved(db, 1);
        Assert.True(FindItem(root, "chicken").GetProperty("isChecked").GetBoolean());
    }

    [Fact]
    public async Task Regenerate_PreservesCheckedState_AndCustomItems()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        PlanMeal(db, 1, "Monday", "dinner", recipe.Id);

        var controller = NewController(db);
        var generated = await Generate(db, 1);
        var chickenId = FindItem(generated, "chicken").GetProperty("id").GetInt32();

        await controller.UpdateItem(1, chickenId, new GroceryItemUpdateDTO { IsChecked = true });
        await controller.AddItem(1, new GroceryItemCreateDTO { Name = "paper towels" });

        var root = await Generate(db, 1);

        Assert.True(FindItem(root, "chicken").GetProperty("isChecked").GetBoolean());
        Assert.True(FindItem(root, "paper towels").GetProperty("isCustom").GetBoolean());
    }

    [Fact]
    public async Task DeleteItem_RemovesIt()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken");
        PlanMeal(db, 1, "Monday", "dinner", recipe.Id);

        var generated = await Generate(db, 1);
        var id = FindItem(generated, "chicken").GetProperty("id").GetInt32();

        await NewController(db).DeleteItem(1, id);

        var root = await GetSaved(db, 1);
        Assert.Equal(JsonValueKind.Null, root.GetProperty("items").ValueKind);
    }

    [Fact]
    public async Task UncheckAll_ClearsEveryCheckedItem()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        PlanMeal(db, 1, "Monday", "dinner", recipe.Id);

        var controller = NewController(db);
        var generated = await Generate(db, 1);

        foreach (var item in generated.GetProperty("items").EnumerateArray())
        {
            await controller.UpdateItem(1, item.GetProperty("id").GetInt32(),
                new GroceryItemUpdateDTO { IsChecked = true });
        }

        await controller.UncheckAll(1);

        var root = await GetSaved(db, 1);
        Assert.All(root.GetProperty("items").EnumerateArray(),
            i => Assert.False(i.GetProperty("isChecked").GetBoolean()));
    }

    [Fact]
    public async Task AddItem_DuplicateName_ReturnsConflict()
    {
        using var db = TestHelpers.NewDb();
        var controller = NewController(db);

        await controller.AddItem(1, new GroceryItemCreateDTO { Name = "foil" });
        var result = await controller.AddItem(1, new GroceryItemCreateDTO { Name = "Foil" });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, status.StatusCode);
    }

    [Fact]
    public async Task UpdateItem_OtherUsersItem_ReturnsNotFound()
    {
        using var db = TestHelpers.NewDb();
        var controller = NewController(db);

        var added = ToJson(await controller.AddItem(2, new GroceryItemCreateDTO { Name = "tofu" }));
        var id = added.GetProperty("id").GetInt32();

        var result = await controller.UpdateItem(1, id, new GroceryItemUpdateDTO { IsChecked = true });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, status.StatusCode);
    }
}
