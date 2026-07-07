using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class LoginResponseDTO
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = string.Empty;
}