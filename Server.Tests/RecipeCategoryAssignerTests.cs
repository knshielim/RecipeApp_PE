using Server.Data;
using Server.Models;
using Server.Services;
using Xunit;

namespace Server.Tests;

public class RecipeCategoryAssignerTests
{
    [Fact]
    public void InferCategories_TagsWesternPastaDishes()
    {
        var pastaTitles = new[]
        {
            "Pesto Pasta",
            "Spaghetti Bolognese",
            "Mac and Cheese",
            "Carbonara",
            "Alfredo Pasta",
            "Pasta Primavera",
            "Lasagna",
            "Macaroni and Cheese",
            "Tuna Pasta Salad",
        };

        foreach (var title in pastaTitles)
        {
            var recipe = SeedRecipes.GetSeedRecipes().First(r => r.Title == title);
            var categories = RecipeCategoryAssigner.InferCategories(recipe).ToList();
            Assert.Contains("Pasta", categories);
        }
    }

    [Fact]
    public void InferCategories_DoesNotTagAsianNoodleDishesAsPasta()
    {
        var nonPastaTitles = new[]
        {
            "Chicken Noodle Soup",
            "Veggie Noodle Soup",
            "Instant Ramen",
            "Pad Thai",
            "Shrimp Garlic Noodles",
            "Zucchini Noodles",
        };

        foreach (var title in nonPastaTitles)
        {
            var recipe = SeedRecipes.GetSeedRecipes().First(r => r.Title == title);
            var categories = RecipeCategoryAssigner.InferCategories(recipe).ToList();
            Assert.DoesNotContain("Pasta", categories);
        }
    }

    [Fact]
    public void EnsureAssignments_AddsMissingPastaAssignments()
    {
        using var db = TestHelpers.NewDb();
        db.RecipeCategories.Add(new RecipeCategory { Name = "Pasta", Emoji = "🍝", ColorKey = "orange", SortOrder = 5 });
        db.RecipeCategories.Add(new RecipeCategory { Name = "Italian", Emoji = "🇮🇹", ColorKey = "violet", SortOrder = 12 });
        db.RecipeCategories.Add(new RecipeCategory { Name = "Comfort Food", Emoji = "🍲", ColorKey = "warm", SortOrder = 15 });
        db.RecipeCategories.Add(new RecipeCategory { Name = "Kids Friendly", Emoji = "👶", ColorKey = "baby", SortOrder = 18 });
        db.RecipeCategories.Add(new RecipeCategory { Name = "Healthy", Emoji = "💚", ColorKey = "mint", SortOrder = 17 });
        db.RecipeCategories.Add(new RecipeCategory { Name = "Salad", Emoji = "🥬", ColorKey = "emerald", SortOrder = 7 });
        db.RecipeCategories.Add(new RecipeCategory { Name = "Seafood", Emoji = "🦐", ColorKey = "cyan", SortOrder = 10 });
        db.Recipes.AddRange(SeedRecipes.GetSeedRecipes());
        db.SaveChanges();

        RecipeCategoryAssigner.EnsureAssignments(db);

        var pastaCategoryId = db.RecipeCategories.Single(c => c.Name == "Pasta").Id;
        var pastaRecipeCount = db.RecipeCategoryAssignments
            .Count(a => a.RecipeCategoryId == pastaCategoryId);

        Assert.Equal(10, pastaRecipeCount);
    }
}
