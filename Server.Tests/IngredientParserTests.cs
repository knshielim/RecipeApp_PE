using Server.Services;
using Xunit;

namespace Server.Tests;

public class IngredientParserTests
{
    [Theory]
    [InlineData("2 eggs", "eggs", 2, "")]
    [InlineData("200 g rice", "rice", 200, "g")]
    [InlineData("1.5 kg beef", "beef", 1.5, "kg")]
    [InlineData("2 cups flour", "flour", 2, "cup")]
    [InlineData("1 cup flour", "flour", 1, "cup")]
    [InlineData("3 tablespoons olive oil", "olive oil", 3, "tbsp")]
    [InlineData("2 cloves garlic", "garlic", 2, "clove")]
    [InlineData("2 cups of flour", "flour", 2, "cup")]
    public void Parse_QuantityUnitName(string text, string name, double qty, string unit)
    {
        var parsed = IngredientParser.Parse(text);

        Assert.Equal(name, parsed.Name);
        Assert.Equal(qty, parsed.Quantity, 3);
        Assert.Equal(unit, parsed.Unit);
        Assert.True(parsed.HasQuantity);
    }

    [Theory]
    [InlineData("1/2 cup sugar", 0.5)]
    [InlineData("3/4 tsp salt", 0.75)]
    [InlineData("1 1/2 cups flour", 1.5)]
    [InlineData("½ cup sugar", 0.5)]
    [InlineData("1½ cups flour", 1.5)]
    [InlineData("¾ tsp salt", 0.75)]
    public void Parse_Fractions(string text, double expected)
    {
        var parsed = IngredientParser.Parse(text);

        Assert.Equal(expected, parsed.Quantity, 3);
        Assert.True(parsed.HasQuantity);
    }

    [Fact]
    public void Parse_NoQuantity_ReturnsWholeTextAsName()
    {
        var parsed = IngredientParser.Parse("rolled oats");

        Assert.Equal("rolled oats", parsed.Name);
        Assert.Equal(1, parsed.Quantity);
        Assert.Equal("", parsed.Unit);
        Assert.False(parsed.HasQuantity);
    }

    [Theory]
    [InlineData("1 onion, diced, 2 cloves garlic", new[] { "1 onion", "2 cloves garlic" })]
    [InlineData("2 eggs, beaten, salt", new[] { "2 eggs", "salt" })]
    [InlineData("1 carrot, finely chopped, milk", new[] { "1 carrot", "milk" })]
    [InlineData("salt, to taste", new[] { "salt" })]
    [InlineData("parsley, for garnish", new[] { "parsley" })]
    [InlineData("rolled oats, milk, honey", new[] { "rolled oats", "milk", "honey" })]
    public void SplitEntries_DropsPrepNotes_KeepsIngredients(string input, string[] expected)
    {
        var entries = IngredientParser.SplitEntries(input).ToArray();

        Assert.Equal(expected, entries);
    }

    [Fact]
    public void ToBaseUnit_ConvertsKgAndL()
    {
        Assert.Equal((1500d, "g"), IngredientParser.ToBaseUnit(1.5, "kg"));
        Assert.Equal((2000d, "ml"), IngredientParser.ToBaseUnit(2, "l"));
        Assert.Equal((3d, "cup"), IngredientParser.ToBaseUnit(3, "cup"));
    }

    [Fact]
    public void ToDisplayUnit_UpgradesLargeQuantities()
    {
        Assert.Equal((1.5, "kg"), IngredientParser.ToDisplayUnit(1500, "g"));
        Assert.Equal((1.25, "l"), IngredientParser.ToDisplayUnit(1250, "ml"));
        Assert.Equal((900d, "g"), IngredientParser.ToDisplayUnit(900, "g"));
        Assert.Equal((2000d, "cup"), IngredientParser.ToDisplayUnit(2000, "cup"));
    }
}
