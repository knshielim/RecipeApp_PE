namespace Server.DTO;

public class AdminRecipeDTO
{
    public string Title { get; set; } = "";
    public string Ingredients { get; set; } = "";
    public string Category { get; set; } = "";
    public string? ImageUrl { get; set; }
}
