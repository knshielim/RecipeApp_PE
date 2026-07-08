using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class GroceryItemCreateDTO
{
    [Required(ErrorMessage = "Item name is required.")]
    [StringLength(120, MinimumLength = 1, ErrorMessage = "Item name must be between 1 and 120 characters.")]
    public string Name { get; set; } = string.Empty;

    [Range(0, 1000000, ErrorMessage = "Quantity must be between 0 and 1,000,000.")]
    public double Quantity { get; set; }

    [StringLength(20, ErrorMessage = "Unit cannot exceed 20 characters.")]
    public string Unit { get; set; } = string.Empty;
}

public class GroceryItemUpdateDTO
{
    public bool? IsChecked { get; set; }

    [Range(0, 1000000, ErrorMessage = "Quantity must be between 0 and 1,000,000.")]
    public double? Quantity { get; set; }

    [StringLength(20, ErrorMessage = "Unit cannot exceed 20 characters.")]
    public string? Unit { get; set; }

    [StringLength(120, MinimumLength = 1, ErrorMessage = "Item name must be between 1 and 120 characters.")]
    public string? Name { get; set; }
}
