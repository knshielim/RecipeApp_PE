namespace Server.Models;

public class Recipe
{
    public int Id { get; set; }

    public int UserId { get; set; }

    // New ownership fields
    public string OwnerUsername { get; set; } = "";
    public string WriterUsername { get; set; } = "";

    public string Title { get; set; } = "";
    public string Ingredients { get; set; } = "";
    public string Steps { get; set; } = "";
    public string Category { get; set; } = "";
    public string ImageUrl { get; set; } = "";
}