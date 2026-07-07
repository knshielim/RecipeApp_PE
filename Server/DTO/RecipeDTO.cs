namespace Server.DTO;

public class RecipeDTO
{
    public int Id { get; set; }
    public int UserId { get; set; }

    public string OwnerUsername { get; set; } = string.Empty;
    public string WriterUsername { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string Ingredients { get; set; } = string.Empty;
    public string Steps { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;

    public bool IsFavorite { get; set; }
}