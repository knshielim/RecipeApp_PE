using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server.Services;

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

    public bool SetActive(string username, bool isActive)
    {
        var user = Find(username);
        if (user is null) return false;
        user.IsActive = isActive;
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

    public static void EnsureCommunityUsers(AppDbContext db)
    {
        var communityUsers = new[]
        {
            new User
            {
                Username = "marco",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Marco Reyes",
                Email = "marco@example.com",
                PhoneNumber = "0811111111",
                DateOfBirth = "1994-03-20",
                Gender = "Male"
            },
            new User
            {
                Username = "priya",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Priya Sharma",
                Email = "priya@example.com",
                PhoneNumber = "0822222222",
                DateOfBirth = "1996-08-09",
                Gender = "Female"
            },
            new User
            {
                Username = "sam",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Sam Wilson",
                Email = "sam@example.com",
                PhoneNumber = "0833333333",
                DateOfBirth = "1993-12-01",
                Gender = "Male"
            },
            new User
            {
                Username = "jordan",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Jordan Kim",
                Email = "jordan@example.com",
                PhoneNumber = "0844444444",
                DateOfBirth = "1997-06-18",
                Gender = "Non-binary"
            },
            new User
            {
                Username = "nina",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Nina Patel",
                Email = "nina@example.com",
                PhoneNumber = "0855555555",
                DateOfBirth = "1999-01-25",
                Gender = "Female"
            },
            new User
            {
                Username = "liam",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Liam O'Brien",
                Email = "liam@example.com",
                PhoneNumber = "0866666666",
                DateOfBirth = "1992-10-30",
                Gender = "Male"
            },
            new User
            {
                Username = "sofia",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Sofia Martinez",
                Email = "sofia@example.com",
                PhoneNumber = "0877777777",
                DateOfBirth = "1998-04-11",
                Gender = "Female"
            },
            new User
            {
                Username = "daniel",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Daniel Chen",
                Email = "daniel@example.com",
                PhoneNumber = "0888888888",
                DateOfBirth = "1991-07-07",
                Gender = "Male"
            },
            new User
            {
                Username = "mei",
                PasswordHash = Hash("password123"),
                Role = "User",
                FullName = "Mei Wong",
                Email = "mei@example.com",
                PhoneNumber = "0899999999",
                DateOfBirth = "1995-02-14",
                Gender = "Female"
            }
        };

        foreach (var user in communityUsers)
        {
            if (!db.Users.Any(u => u.Username.ToLower() == user.Username.ToLower()))
                db.Users.Add(user);
        }

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
