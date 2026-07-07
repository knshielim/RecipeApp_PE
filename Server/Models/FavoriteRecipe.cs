namespace Server.Models;

public class FavoriteRecipe
{
    public int Id { get; set; }

    public string Username { get; set; } = "";

    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}