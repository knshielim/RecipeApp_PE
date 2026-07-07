using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class UpdateRecipeDTO
{
    [Required(ErrorMessage = "Recipe title is required.")]
    [StringLength(120, MinimumLength = 2, ErrorMessage = "Recipe title must be between 2 and 120 characters.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Ingredients are required.")]
    [StringLength(1000, MinimumLength = 2, ErrorMessage = "Ingredients must be between 2 and 1000 characters.")]
    public string Ingredients { get; set; } = string.Empty;

    [Required(ErrorMessage = "Cooking instructions are required.")]
    [StringLength(3000, MinimumLength = 5, ErrorMessage = "Cooking instructions must be between 5 and 3000 characters.")]
    public string Steps { get; set; } = string.Empty;

    [Required(ErrorMessage = "Category is required.")]
    [StringLength(80, MinimumLength = 2, ErrorMessage = "Category must be between 2 and 80 characters.")]
    public string Category { get; set; } = string.Empty;

    [StringLength(50, ErrorMessage = "Diet restriction cannot exceed 50 characters.")]
    [RegularExpression(
        "^(|none|vegetarian|vegan|gluten-free|dairy-free|nut-free|low-carb|paleo|low-sodium|sugar-free|whole30|mediterranean|pescatarian|halal)$",
        ErrorMessage = "Diet restriction must be empty or one of the supported diet options."
    )]
    public string DietRestriction { get; set; } = string.Empty;

    [StringLength(300, ErrorMessage = "Allergens cannot exceed 300 characters.")]
    public string Allergens { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Image URL cannot exceed 500 characters.")]
    public string ImageUrl { get; set; } = string.Empty;

    public List<int> CategoryIds { get; set; } = new();
}