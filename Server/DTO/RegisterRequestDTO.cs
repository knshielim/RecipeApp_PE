using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class RegisterRequestDTO
{
    [Required(ErrorMessage = "Username is required.")]
    [StringLength(40, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 40 characters.")]
    [RegularExpression(
        "^[a-zA-Z0-9_]+$",
        ErrorMessage = "Username can only contain letters, numbers, and underscores."
    )]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be between 6 and 100 characters.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Role is required.")]
    [RegularExpression("^(Admin|User)$", ErrorMessage = "Role must be either Admin or User.")]
    public string Role { get; set; } = "User"; // "Admin" or "User"

    // Profile information collected on the registration form
    [Required(ErrorMessage = "Full name is required.")]
    [StringLength(120, MinimumLength = 2, ErrorMessage = "Full name must be between 2 and 120 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Please enter a valid email address.")]
    [StringLength(150, ErrorMessage = "Email cannot exceed 150 characters.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required.")]
    [Phone(ErrorMessage = "Please enter a valid phone number.")]
    [StringLength(30, ErrorMessage = "Phone number cannot exceed 30 characters.")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Date of birth is required.")]
    [RegularExpression(
        @"^\d{4}-\d{2}-\d{2}$",
        ErrorMessage = "Date of birth must use the format yyyy-MM-dd."
    )]
    public string DateOfBirth { get; set; } = string.Empty; // yyyy-MM-dd

    [Required(ErrorMessage = "Gender is required.")]
    [RegularExpression(
        "^(Male|Female|Other)$",
        ErrorMessage = "Gender must be Male, Female, or Other."
    )]
    public string Gender { get; set; } = string.Empty;
}