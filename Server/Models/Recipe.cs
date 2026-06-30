public class Recipe
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = "";
    public string Ingredients { get; set; } = "";
    public string Category { get; set; } = "";
}