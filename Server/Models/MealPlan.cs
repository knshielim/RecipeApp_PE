namespace Server.Models;

public class MealPlan
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateOnly WeekStartDate { get; set; }
    public string Day { get; set; } = "";
    public string MealSlot { get; set; } = "";
    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;
}