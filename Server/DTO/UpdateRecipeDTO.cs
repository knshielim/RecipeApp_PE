namespace Server.DTO;

public class UpdateRecipeDTO
{
    public string Title { get; set; } = string.Empty;
    public string Ingredients { get; set; } = string.Empty;
    public string Steps { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
}