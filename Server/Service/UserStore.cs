using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server.Services;

/// <summary>
/// SQLite-backed user store so accounts survive server restarts.
/// </summary>
public class UserStore
{
    private readonly AppDbContext _db;

    public UserStore(AppDbContext db)
    {
        _db = db;
    }

    private static string Normalize(string username) => username.Trim().ToLowerInvariant();

    public bool Exists(string username)
    {
        var key = Normalize(username);
        return _db.Users.AsNoTracking().Any(u => u.Username.ToLower() == key);
    }

    public User? Find(string username)
    {
        var key = Normalize(username);
        return _db.Users.FirstOrDefault(u => u.Username.ToLower() == key);
    }

    public bool Add(User user)
    {
        if (Exists(user.Username)) return false;
        _db.Users.Add(user);
        _db.SaveChanges();
        return true;
    }

    public bool Remove(string username)
    {
        var user = Find(username);
        if (user is null) return false;
        _db.Users.Remove(user);
        _db.SaveChanges();
        return true;
    }

    public bool UpdateRole(string username, string role)
    {
        var user = Find(username);
        if (user is null) return false;
        user.Role = role;
        _db.SaveChanges();
        return true;
    }

    public bool UpdateProfile(string username, string fullName, string email,
        string phoneNumber, string dateOfBirth, string gender)
    {
        var user = Find(username);
        if (user is null) return false;
        user.FullName = fullName;
        user.Email = email;
        user.PhoneNumber = phoneNumber;
        user.DateOfBirth = dateOfBirth;
        user.Gender = gender;
        _db.SaveChanges();
        return true;
    }

    public bool UpdateProfilePicture(string username, string? profilePicture)
    {
        var user = Find(username);
        if (user is null) return false;
        user.ProfilePicture = profilePicture ?? string.Empty;
        _db.SaveChanges();
        return true;
    }

    public bool SetPassword(string username, string newPassword)
    {
        var user = Find(username);
        if (user is null) return false;
        user.PasswordHash = Hash(newPassword);
        _db.SaveChanges();
        return true;
    }

    public List<User> GetAll()
    {
        return _db.Users.AsNoTracking().OrderBy(u => u.CreatedAt).ToList();
    }

    public bool Verify(string username, string password, out User? user)
    {
        user = Find(username);
        return user is not null && VerifyHash(password, user.PasswordHash);
    }

    public static void SeedDefaults(AppDbContext db)
    {
        if (db.Users.Any()) return;

        db.Users.AddRange(
            new User
            {
                Username = "admin",
                PasswordHash = Hash("admin123"),
                Role = "Admin",
                FullName = "Site Administrator",
                Email = "admin@recipeapp.local",
                PhoneNumber = "0800000000",
                DateOfBirth = "1990-01-01",
                Gender = "Other"
            },
            new User
            {
                Username = "alice",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Alice Tan",
                Email = "alice@example.com",
                PhoneNumber = "0812345678",
                DateOfBirth = "1998-05-14",
                Gender = "Female"
            },
            new User
            {
                Username = "bob",
                PasswordHash = Hash("securepass"),
                Role = "User",
                FullName = "Bob Lee",
                Email = "bob@example.com",
                PhoneNumber = "0898765432",
                DateOfBirth = "1995-11-02",
                Gender = "Male"
            }
        );
        db.SaveChanges();
    }

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
