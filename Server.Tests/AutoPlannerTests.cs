using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Server.Models;
using Server.Services;
using Xunit;
using static Server.Tests.TestHelpers;

namespace Server.Tests;

public class AutoPlanBuilderTests
{
    private static Recipe R(int id, string title, string ingredients)
        => new() { Id = id, UserId = 1, Title = title, Ingredients = ingredients, Category = "Dinner" };

    [Fact]
    public void BuildWeek_FillsAll21Slots()
    {
        var recipes = new List<Recipe> { R(1, "A", "rice"), R(2, "B", "beef"), R(3, "C", "tofu") };

        var week = AutoPlanBuilder.BuildWeek(recipes, null, new List<MealSlotSuggestion>());

        Assert.Equal(21, week.Count);
        foreach (var day in AutoPlanBuilder.Days)
            foreach (var slot in AutoPlanBuilder.Slots)
                Assert.Single(week, s => s.Day == day && s.MealSlot == slot);
    }

    [Fact]
    public void BuildWeek_NeverAssignsAllergenRecipes_EvenWhenAiSuggestsThem()
    {
        var recipes = new List<Recipe>
        {
            R(1, "Peanut Noodles", "noodles, peanut butter"),
            R(2, "Rice Bowl", "rice, chicken"),
        };
        var prefs = new UserPreference { UserId = 1, Allergies = "peanuts" };
        // AI (mocked output) tries to assign the allergen recipe everywhere
        var badSuggestions = AutoPlanBuilder.Days
            .SelectMany(d => AutoPlanBuilder.Slots.Select(s => new MealSlotSuggestion(d, s, 1)))
            .ToList();

        var week = AutoPlanBuilder.BuildWeek(recipes, prefs, badSuggestions);

        Assert.Equal(21, week.Count);
        Assert.All(week, s => Assert.Equal(2, s.RecipeId));
    }

    [Fact]
    public void BuildWeek_AllRecipesExcludedByAllergies_ReturnsEmpty()
    {
        var recipes = new List<Recipe> { R(1, "Peanut Noodles", "peanut butter") };
        var prefs = new UserPreference { UserId = 1, Allergies = "peanuts" };

        var week = AutoPlanBuilder.BuildWeek(recipes, prefs, new List<MealSlotSuggestion>());

        Assert.Empty(week);
    }

    [Fact]
    public void BuildWeek_VarietyIsBalanced_NoRecipeOverusedWhileOthersUnused()
    {
        var recipes = Enumerable.Range(1, 7).Select(i => R(i, $"Recipe {i}", "safe food")).ToList();

        var week = AutoPlanBuilder.BuildWeek(recipes, null, new List<MealSlotSuggestion>());

        var usage = week.GroupBy(s => s.RecipeId).Select(g => g.Count()).ToList();
        // 21 slots over 7 recipes: everyone used exactly 3 times
        Assert.Equal(7, usage.Count);
        Assert.All(usage, count => Assert.Equal(3, count));
    }

    [Fact]
    public void BuildWeek_ValidAiSuggestionsAreKept()
    {
        var recipes = new List<Recipe> { R(1, "A", "rice"), R(2, "B", "beef") };
        var suggestions = new List<MealSlotSuggestion>
        {
            new("Monday", "breakfast", 2),
            new("friday", "DINNER", 2), // case-insensitive matching
        };

        var week = AutoPlanBuilder.BuildWeek(recipes, null, suggestions);

        Assert.Equal(2, week.Single(s => s.Day == "Monday" && s.MealSlot == "breakfast").RecipeId);
        Assert.Equal(2, week.Single(s => s.Day == "Friday" && s.MealSlot == "dinner").RecipeId);
    }

    [Fact]
    public void BuildWeek_InvalidAiSuggestions_AreDiscarded()
    {
        var recipes = new List<Recipe> { R(1, "A", "rice") };
        var suggestions = new List<MealSlotSuggestion>
        {
            new("Blursday", "dinner", 1),   // bad day
            new("Monday", "brunch", 1),     // bad slot
            new("Monday", "dinner", 999),   // unknown recipe
        };

        var week = AutoPlanBuilder.BuildWeek(recipes, null, suggestions);

        Assert.Equal(21, week.Count);
        Assert.All(week, s => Assert.Equal(1, s.RecipeId));
    }

    [Fact]
    public void ParseSuggestions_HandlesMarkdownFencedJson()
    {
        var content = "Here is your plan:\n```json\n[{\"day\":\"Monday\",\"mealSlot\":\"lunch\",\"recipeId\":4}]\n```";

        var parsed = MealPlanSuggester.ParseSuggestions(content);

        var s = Assert.Single(parsed);
        Assert.Equal("Monday", s.Day);
        Assert.Equal("lunch", s.MealSlot);
        Assert.Equal(4, s.RecipeId);
    }

    [Fact]
    public void ParseSuggestions_GarbageInput_ReturnsEmpty()
    {
        Assert.Empty(MealPlanSuggester.ParseSuggestions("Sorry, I cannot do that."));
        Assert.Empty(MealPlanSuggester.ParseSuggestions("[not valid json]"));
        Assert.Empty(MealPlanSuggester.ParseSuggestions(""));
    }
}

public class AutoGenerateEndpointTests
{
    [Fact]
    public async Task AutoGenerate_FillsWeek_UsingMockedAiSuggestions()
    {
        using var db = TestHelpers.NewDb();
        var a = TestHelpers.AddRecipe(db, 1, "A", "rice");
        var b = TestHelpers.AddRecipe(db, 1, "B", "beef");
        var fake = new FakeSuggester
        {
            Suggestions = new List<MealSlotSuggestion> { new("Monday", "breakfast", b.Id) }
        };
        var controller = TestHelpers.NewController(db, fake);

        var result = await controller.AutoGenerate(1);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(fake.WasCalled);
        Assert.Equal(21, db.MealPlans.Count(m => m.UserId == 1));
        Assert.Equal(b.Id, db.MealPlans.Single(m => m.Day == "Monday" && m.MealSlot == "breakfast").RecipeId);
    }

    [Fact]
    public async Task AutoGenerate_RespectsAllergies_FromStoredPreferences()
    {
        using var db = TestHelpers.NewDb();
        var peanut = TestHelpers.AddRecipe(db, 1, "Peanut Noodles", "noodles, peanut butter");
        var safe = TestHelpers.AddRecipe(db, 1, "Rice Bowl", "rice, chicken");
        db.UserPreferences.Add(new UserPreference { UserId = 1, Goal = "maintain", DietType = "none", Allergies = "peanuts" });
        db.SaveChanges();
        // mocked AI ignores the allergy and suggests the peanut recipe
        var fake = new FakeSuggester
        {
            Suggestions = new List<MealSlotSuggestion> { new("Monday", "dinner", peanut.Id) }
        };
        var controller = TestHelpers.NewController(db, fake);

        var result = await controller.AutoGenerate(1);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(21, db.MealPlans.Count());
        Assert.DoesNotContain(db.MealPlans, m => m.RecipeId == peanut.Id);
        Assert.All(db.MealPlans, m => Assert.Equal(safe.Id, m.RecipeId));
    }

    [Fact]
    public async Task AutoGenerate_ReplacesExistingPlan()
    {
        using var db = TestHelpers.NewDb();
        var recipe = TestHelpers.AddRecipe(db, 1, "A", "rice");
        db.MealPlans.Add(new MealPlan { UserId = 1, WeekStartDate = TestHelpers.CurrentWeek, Day = "Monday", MealSlot = "dinner", RecipeId = recipe.Id });
        db.SaveChanges();
        var controller = TestHelpers.NewController(db);

        await controller.AutoGenerate(1);

        // exactly one full week, not the old entry plus 21 new ones
        Assert.Equal(21, db.MealPlans.Count(m => m.UserId == 1));
    }

    [Fact]
    public async Task AutoGenerate_NoRecipes_ReturnsBadRequest()
    {
        using var db = TestHelpers.NewDb();
        var controller = TestHelpers.NewController(db);

        var result = await controller.AutoGenerate(1);

        AssertStatus(result, StatusCodes.Status400BadRequest);
    }

    [Fact]
    public async Task AutoGenerate_AllRecipesBlockedByAllergies_ReturnsBadRequest()
    {
        using var db = TestHelpers.NewDb();
        TestHelpers.AddRecipe(db, 1, "Peanut Noodles", "peanut butter");
        db.UserPreferences.Add(new UserPreference { UserId = 1, Allergies = "peanuts" });
        db.SaveChanges();
        var controller = TestHelpers.NewController(db);

        var result = await controller.AutoGenerate(1);

        AssertStatus(result, StatusCodes.Status400BadRequest);
        Assert.Empty(db.MealPlans);
    }

    [Fact]
    public async Task AutoGenerate_DoesNotTouchOtherUsersPlans()
    {
        using var db = TestHelpers.NewDb();
        var mine = TestHelpers.AddRecipe(db, 1, "Mine", "rice");
        var theirs = TestHelpers.AddRecipe(db, 2, "Theirs", "beef");
        db.MealPlans.Add(new MealPlan { UserId = 2, WeekStartDate = TestHelpers.CurrentWeek, Day = "Monday", MealSlot = "dinner", RecipeId = theirs.Id });
        db.SaveChanges();
        var controller = TestHelpers.NewController(db);

        await controller.AutoGenerate(1);

        Assert.Equal(1, db.MealPlans.Count(m => m.UserId == 2));
        Assert.Equal(21, db.MealPlans.Count(m => m.UserId == 1));
    }
}
