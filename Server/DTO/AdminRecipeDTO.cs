using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class AdminRecipeDTO
{
    [Required(ErrorMessage = "Recipe title is required.")]
    [StringLength(120, ErrorMessage = "Recipe title cannot exceed 120 characters.")]
    public string Title { get; set; } = "";

    [Required(ErrorMessage = "Ingredients are required.")]
    [StringLength(1000, ErrorMessage = "Ingredients cannot exceed 1000 characters.")]
    public string Ingredients { get; set; } = "";

    [Required(ErrorMessage = "Cooking instructions are required.")]
    [StringLength(3000, ErrorMessage = "Cooking instructions cannot exceed 3000 characters.")]
    public string Steps { get; set; } = "";

    [Required(ErrorMessage = "Category is required.")]
    [StringLength(80, ErrorMessage = "Category cannot exceed 80 characters.")]
    public string Category { get; set; } = "";

    [StringLength(120, ErrorMessage = "Owner name cannot exceed 120 characters.")]
    public string OwnerName { get; set; } = "";

    public string? ImageUrl { get; set; }
}