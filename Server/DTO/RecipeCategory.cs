using System.ComponentModel.DataAnnotations;

namespace Server.Models;

public class RecipeCategory
{
    public int Id { get; set; }

    [Required]
    [StringLength(60)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(8)]
    public string Emoji { get; set; } = "🍽️";

    [Required]
    [StringLength(30)]
    public string ColorKey { get; set; } = "amber";

    [Range(0, 999)]
    public int SortOrder { get; set; } = 0;
}