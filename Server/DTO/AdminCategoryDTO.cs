using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class AdminCategoryDTO
{
    [Required(ErrorMessage = "Category name is required.")]
    [StringLength(60, MinimumLength = 2, ErrorMessage = "Category name must be between 2 and 60 characters.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(8, ErrorMessage = "Emoji cannot exceed 8 characters.")]
    public string Emoji { get; set; } = "";

    [Required(ErrorMessage = "Color is required.")]
    [StringLength(30, ErrorMessage = "Color key cannot exceed 30 characters.")]
    [RegularExpression(
        "^[a-zA-Z0-9_-]+$",
        ErrorMessage = "Color key can only contain letters, numbers, hyphens, or underscores."
    )]
    public string ColorKey { get; set; } = "amber";

    [Range(0, 999, ErrorMessage = "Sort order must be between 0 and 999.")]
    public int SortOrder { get; set; } = 0;
}