namespace Server.Models;

public class Recipe
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string OwnerName { get; set; } = "";
    public string DietRestriction { get; set; } = "";
    public string Allergens { get; set; } = "";

    public string Title { get; set; } = "";
    public string Ingredients { get; set; } = "";
    public string Steps { get; set; } = "";
    public string Category { get; set; } = ""; // Kept for backward compatibility, primary category
    public string ImageUrl { get; set; } = "";

    public ICollection<RecipeCategoryAssignment> CategoryAssignments { get; set; } = new List<RecipeCategoryAssignment>();
}
