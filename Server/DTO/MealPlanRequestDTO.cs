using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class MealPlanRequestDTO
{
    [Range(1, int.MaxValue, ErrorMessage = "User ID must be valid.")]
    public int UserId { get; set; }

    [RegularExpression(
        @"^\d{4}-\d{2}-\d{2}$|^$",
        ErrorMessage = "Week start date must use the format yyyy-MM-dd."
    )]
    public string? WeekStartDate { get; set; } // ISO date of the Monday for this week

    [Required(ErrorMessage = "Day is required.")]
    [RegularExpression(
        "^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$",
        ErrorMessage = "Day must be a valid weekday from Monday to Sunday."
    )]
    public string Day { get; set; } = string.Empty;

    [Required(ErrorMessage = "Meal slot is required.")]
    [RegularExpression(
        "^(breakfast|lunch|dinner)$",
        ErrorMessage = "Meal slot must be breakfast, lunch, or dinner."
    )]
    public string MealSlot { get; set; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "Recipe ID must be valid.")]
    public int RecipeId { get; set; }
}