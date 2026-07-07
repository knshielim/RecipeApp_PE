namespace Server.Models;

public class RecipeCategoryAssignment
{
    public int Id { get; set; }
    public int RecipeId { get; set; }
    public int RecipeCategoryId { get; set; }

    public Recipe Recipe { get; set; } = null!;
    public RecipeCategory RecipeCategory { get; set; } = null!;
}
