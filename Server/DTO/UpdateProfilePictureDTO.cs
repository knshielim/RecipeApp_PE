using System.ComponentModel.DataAnnotations;

namespace Server.DTO;

public class UpdateProfilePictureDTO
{
    [StringLength(600000, ErrorMessage = "Profile picture is too large. Please use a smaller image.")]
    public string? ProfilePicture { get; set; }
}