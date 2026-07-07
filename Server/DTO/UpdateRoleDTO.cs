using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class UpdateRoleDTO
{
    [Required(ErrorMessage = "Role is required.")]
    [RegularExpression("^(Admin|User)$", ErrorMessage = "Role must be either Admin or User.")]
    public string Role { get; set; } = string.Empty;
}