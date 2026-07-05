namespace Server.DTO;

public class MealPlanRequestDTO
{
    public int UserId { get; set; }
    public string Day { get; set; } = string.Empty;      // "Monday" ... "Sunday"
    public string MealSlot { get; set; } = string.Empty; // "breakfast", "lunch", "dinner"
    public int RecipeId { get; set; }
}
