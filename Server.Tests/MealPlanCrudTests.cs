using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Server.DTO;
using Server.Models;
using Xunit;
using static Server.Tests.TestHelpers;

namespace Server.Tests;

public class MealPlanCrudTests
{
    private static MealPlanRequestDTO Request(int userId, string day, string slot, int recipeId)
        => new() { UserId = userId, Day = day, MealSlot = slot, RecipeId = recipeId };

    [Fact]
    public async Task Create_ValidRequest_SavesEntry()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var controller = TestHelpers.NewController(db);

        var result = await controller.Create(Request(1, "Monday", "dinner", recipe.Id));

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(db.MealPlans);
        Assert.Equal("Monday", saved.Day);
        Assert.Equal("dinner", saved.MealSlot);
        Assert.Equal(recipe.Id, saved.RecipeId);
    }

    [Fact]
    public async Task Create_InvalidDay_ReturnsBadRequest()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var controller = TestHelpers.NewController(db);

        var result = await controller.Create(Request(1, "Someday", "dinner", recipe.Id));

        AssertStatus(result, StatusCodes.Status400BadRequest);
        Assert.Empty(db.MealPlans);
    }

    [Fact]
    public async Task Create_InvalidSlot_ReturnsBadRequest()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var controller = TestHelpers.NewController(db);

        var result = await controller.Create(Request(1, "Monday", "brunch", recipe.Id));

        AssertStatus(result, StatusCodes.Status400BadRequest);
    }

    [Fact]
    public async Task Create_RecipeOfAnotherUser_ReturnsBadRequest()
    {
        using var db = TestHelpers.NewDb();
        var otherUsersRecipe = TestHelpers.AddRecipe(db, userId: 2, "Not Yours", "beef");
        var controller = TestHelpers.NewController(db);

        var result = await controller.Create(Request(1, "Monday", "dinner", otherUsersRecipe.Id));

        AssertStatus(result, StatusCodes.Status400BadRequest);
    }

    [Fact]
    public async Task Create_DuplicateDayAndSlot_ReturnsConflict()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var controller = TestHelpers.NewController(db);

        await controller.Create(Request(1, "Monday", "dinner", recipe.Id));
        var result = await controller.Create(Request(1, "Monday", "dinner", recipe.Id));

        AssertStatus(result, StatusCodes.Status409Conflict);
        Assert.Single(db.MealPlans);
    }

    [Fact]
    public async Task Update_MoveToFreeSlot_Succeeds()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var controller = TestHelpers.NewController(db);
        await controller.Create(Request(1, "Monday", "dinner", recipe.Id));
        var id = db.MealPlans.Single().Id;

        var result = await controller.Update(id, Request(1, "Tuesday", "lunch", recipe.Id));

        Assert.IsType<OkObjectResult>(result);
        var saved = db.MealPlans.Single();
        Assert.Equal("Tuesday", saved.Day);
        Assert.Equal("lunch", saved.MealSlot);
    }

    [Fact]
    public async Task Update_SameSlotAsItself_DoesNotConflict()
    {
        using var db = TestHelpers.NewDb();
        var first = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var second = TestHelpers.AddRecipe(db, 1, "Salad", "lettuce, tomato");
        var controller = TestHelpers.NewController(db);
        await controller.Create(Request(1, "Monday", "dinner", first.Id));
        var id = db.MealPlans.Single().Id;

        // change only the recipe, keep day+slot
        var result = await controller.Update(id, Request(1, "Monday", "dinner", second.Id));

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(second.Id, db.MealPlans.Single().RecipeId);
    }

    [Fact]
    public async Task Update_MoveOntoOccupiedSlot_ReturnsConflict()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var controller = TestHelpers.NewController(db);
        await controller.Create(Request(1, "Monday", "dinner", recipe.Id));
        await controller.Create(Request(1, "Tuesday", "dinner", recipe.Id));
        var tuesdayId = db.MealPlans.Single(m => m.Day == "Tuesday").Id;

        var result = await controller.Update(tuesdayId, Request(1, "Monday", "dinner", recipe.Id));

        AssertStatus(result, StatusCodes.Status409Conflict);
    }

    [Fact]
    public async Task Update_UnknownId_ReturnsNotFound()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var controller = TestHelpers.NewController(db);

        var result = await controller.Update(999, Request(1, "Monday", "dinner", recipe.Id));

        AssertStatus(result, StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task Delete_ExistingEntry_RemovesIt()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var controller = TestHelpers.NewController(db);
        await controller.Create(Request(1, "Monday", "dinner", recipe.Id));
        var id = db.MealPlans.Single().Id;

        var result = await controller.Delete(id);

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(db.MealPlans);
    }

    [Fact]
    public async Task Delete_UnknownId_ReturnsNotFound()
    {
        using var db = TestHelpers.NewDb();
        var controller = TestHelpers.NewController(db);

        var result = await controller.Delete(999);

        AssertStatus(result, StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task GetMealPlans_ReturnsOnlyOwnEntriesWithRecipeInfo()
    {
        using var db = TestHelpers.NewDb();
        var mine = TestHelpers.AddRecipe(db, 1, "Stir Fry", "chicken, rice");
        var theirs = TestHelpers.AddRecipe(db, 2, "Other", "beef");
        db.MealPlans.Add(new MealPlan { UserId = 1, WeekStartDate = TestHelpers.CurrentWeek, Day = "Monday", MealSlot = "dinner", RecipeId = mine.Id });
        db.MealPlans.Add(new MealPlan { UserId = 2, WeekStartDate = TestHelpers.CurrentWeek, Day = "Monday", MealSlot = "dinner", RecipeId = theirs.Id });
        db.SaveChanges();
        var controller = TestHelpers.NewController(db);

        var result = Assert.IsType<OkObjectResult>(await controller.GetMealPlans(1));
        var json = System.Text.Json.JsonSerializer.Serialize(result.Value);

        Assert.Contains("Stir Fry", json);
        Assert.DoesNotContain("Other", json);
    }
}
