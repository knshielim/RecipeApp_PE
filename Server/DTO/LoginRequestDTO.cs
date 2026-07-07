using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class LoginRequestDTO
{
    [Required(ErrorMessage = "Username is required.")]
    [StringLength(40, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 40 characters.")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be between 6 and 100 characters.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Role is required.")]
    [RegularExpression("^(Admin|User)$", ErrorMessage = "Role must be either Admin or User.")]
    public string Role { get; set; } = string.Empty; // role selected at login ("Admin" or "User")
}