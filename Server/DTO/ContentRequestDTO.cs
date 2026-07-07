using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class ContentRequestDTO
{
    [Required(ErrorMessage = "Title is required.")]
    [StringLength(120, MinimumLength = 2, ErrorMessage = "Title must be between 2 and 120 characters.")]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000, ErrorMessage = "Body cannot exceed 2000 characters.")]
    public string? Body { get; set; }
}