namespace Server.DTO;

public class RegisterRequestDTO
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "User"; // "Admin" or "User"

    // Profile information collected on the registration form
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string DateOfBirth { get; set; } = string.Empty; // yyyy-MM-dd
    public string Gender { get; set; } = string.Empty;
}
