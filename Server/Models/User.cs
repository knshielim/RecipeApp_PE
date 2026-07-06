namespace Server.Models;

public class User
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "User"; // "Admin" or "User"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true; // false = account deactivated by an admin, cannot log in

    // Profile information (editable from the Profile page)
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string DateOfBirth { get; set; } = string.Empty; // yyyy-MM-dd
    public string Gender { get; set; } = string.Empty;
    public string ProfilePicture { get; set; } = string.Empty; 
}
