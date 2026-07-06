namespace Server.Models;

public class RecipeCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Emoji { get; set; } = "🍽️";

    public string ColorKey { get; set; } = "amber";

    public int SortOrder { get; set; } = 0;
}
