namespace Server.DTO;

public class CreateRecipeDTO
{
    public int UserId { get; set; } = 1;

    public string OwnerName { get; set; } = string.Empty;
    public string DietRestriction { get; set; } = "none";
    public string Allergens { get; set; } = "";

    public string Title { get; set; } = string.Empty;
    public string Ingredients { get; set; } = string.Empty;
    public string Steps { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public List<int> CategoryIds { get; set; } = new();
}
