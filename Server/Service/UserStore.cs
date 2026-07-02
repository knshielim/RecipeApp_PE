using System.Security.Cryptography;
using Server.Models;

namespace Server.Services;

/// <summary>
/// In-memory user store (thread-safe). Replace with EF Core + SQL Server later
/// using the "AppDb" connection string in appsettings.json.
/// </summary>
public class UserStore
{
    private readonly Dictionary<string, User> _users = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _lock = new();

    public UserStore()
    {
        // Seeded accounts for testing
        Add(new User
        {
            Username = "admin", PasswordHash = Hash("admin123"), Role = "Admin",
            FullName = "Site Administrator", Email = "admin@recipeapp.local",
            PhoneNumber = "0800000000", DateOfBirth = "1990-01-01", Gender = "Other"
        });
        Add(new User
        {
            Username = "alice", PasswordHash = Hash("password123"), Role = "User",
            FullName = "Alice Tan", Email = "alice@example.com",
            PhoneNumber = "0812345678", DateOfBirth = "1998-05-14", Gender = "Female"
        });
        Add(new User
        {
            Username = "bob", PasswordHash = Hash("securepass"), Role = "User",
            FullName = "Bob Lee", Email = "bob@example.com",
            PhoneNumber = "0898765432", DateOfBirth = "1995-11-02", Gender = "Male"
        });
    }

    public bool Exists(string username)
    {
        lock (_lock) return _users.ContainsKey(username);
    }

    public User? Find(string username)
    {
        lock (_lock) return _users.TryGetValue(username, out var u) ? u : null;
    }

    public bool Add(User user)
    {
        lock (_lock) return _users.TryAdd(user.Username, user);
    }

    public bool Remove(string username)
    {
        lock (_lock) return _users.Remove(username);
    }

    public bool UpdateRole(string username, string role)
    {
        lock (_lock)
        {
            if (!_users.TryGetValue(username, out var u)) return false;
            u.Role = role;
            return true;
        }
    }

    public bool UpdateProfile(string username, string fullName, string email,
        string phoneNumber, string dateOfBirth, string gender)
    {
        lock (_lock)
        {
            if (!_users.TryGetValue(username, out var u)) return false;
            u.FullName = fullName;
            u.Email = email;
            u.PhoneNumber = phoneNumber;
            u.DateOfBirth = dateOfBirth;
            u.Gender = gender;
            return true;
        }
    }

    public bool SetPassword(string username, string newPassword)
    {
        lock (_lock)
        {
            if (!_users.TryGetValue(username, out var u)) return false;
            u.PasswordHash = Hash(newPassword);
            return true;
        }
    }

    public List<User> GetAll()
    {
        lock (_lock) return _users.Values.OrderBy(u => u.CreatedAt).ToList();
    }

    public bool Verify(string username, string password, out User? user)
    {
        user = Find(username);
        return user is not null && VerifyHash(password, user.PasswordHash);
    }

    // ---- PBKDF2 password hashing ----
    public static string Hash(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(16);
        byte[] key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(key)}";
    }

    private static bool VerifyHash(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 2) return false;
        byte[] salt = Convert.FromBase64String(parts[0]);
        byte[] expected = Convert.FromBase64String(parts[1]);
        byte[] actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
