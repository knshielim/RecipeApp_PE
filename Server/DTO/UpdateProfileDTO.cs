namespace Server.DTO;

public class UpdateProfileDTO
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string DateOfBirth { get; set; } = string.Empty; // yyyy-MM-dd
    public string Gender { get; set; } = string.Empty;
}
