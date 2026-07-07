using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class AdminUpdateUserDTO
{
    [Required(ErrorMessage = "Full name is required.")]
    [StringLength(120, MinimumLength = 2, ErrorMessage = "Full name must be between 2 and 120 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Please enter a valid email address.")]
    [StringLength(150, ErrorMessage = "Email cannot exceed 150 characters.")]
    public string Email { get; set; } = string.Empty;

    [Phone(ErrorMessage = "Please enter a valid phone number.")]
    [StringLength(30, ErrorMessage = "Phone number cannot exceed 30 characters.")]
    public string PhoneNumber { get; set; } = string.Empty;

    [RegularExpression(
        @"^\d{4}-\d{2}-\d{2}$|^$",
        ErrorMessage = "Date of birth must use the format yyyy-MM-dd."
    )]
    public string DateOfBirth { get; set; } = string.Empty;

    [RegularExpression(
        "^(Male|Female|Other|)$",
        ErrorMessage = "Gender must be Male, Female, Other, or empty."
    )]
    public string Gender { get; set; } = string.Empty;

    /// <summary>Optional: leave null/empty to keep the current password.</summary>
    [MinLength(6, ErrorMessage = "New password must be at least 6 characters.")]
    [StringLength(100, ErrorMessage = "New password cannot exceed 100 characters.")]
    public string? NewPassword { get; set; }
}