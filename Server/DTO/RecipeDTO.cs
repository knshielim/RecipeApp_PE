namespace Server.DTO;

// no need validation because its not an input
public class RecipeDTO
{
    public int Id { get; set; }
    public int UserId { get; set; }

    public string OwnerName { get; set; } = string.Empty;
    public string DietRestriction { get; set; } = string.Empty;
    public string Allergens { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string Ingredients { get; set; } = string.Empty;
    public string Steps { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;

    public bool IsFavorite { get; set; }
    public List<CategoryDTO> Categories { get; set; } = new();
}

public class CategoryDTO
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Emoji { get; set; } = string.Empty;
    public string ColorKey { get; set; } = string.Empty;
}
