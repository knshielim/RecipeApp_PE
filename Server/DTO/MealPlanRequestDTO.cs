namespace Server.DTO;

public class MealPlanRequestDTO
{
    public int UserId { get; set; }
    public string? WeekStartDate { get; set; }           // ISO date of the Monday for this week
    public string Day { get; set; } = string.Empty;      // "Monday" ... "Sunday"
    public string MealSlot { get; set; } = string.Empty; // "breakfast", "lunch", "dinner"
    public int RecipeId { get; set; }
}
