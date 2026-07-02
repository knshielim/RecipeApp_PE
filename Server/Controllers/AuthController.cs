using Server.DTO;
using Server.Models;
using Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ServerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly TokenService _tokens;
    private readonly UserStore _users;

    public AuthController(TokenService tokens, UserStore users)
    {
        _tokens = tokens;
        _users = users;
    }

    // POST api/auth/register
    [HttpPost("register")]
    public IActionResult Register([FromBody] RegisterRequestDTO request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Username and password are required." });

        if (request.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        var role = request.Role == "Admin" ? "Admin" : "User";

        var user = new User
        {
            Username = request.Username.Trim(),
            PasswordHash = UserStore.Hash(request.Password),
            Role = role,
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            DateOfBirth = request.DateOfBirth.Trim(),
            Gender = request.Gender.Trim()
        };

        if (!_users.Add(user))
            return Conflict(new { message = "Username is already taken." });

        return Ok(new { message = $"Account '{user.Username}' created as {user.Role}. You can now log in." });
    }

    // POST api/auth/login
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequestDTO request)
    {
        if (!_users.Verify(request.Username, request.Password, out var user) || user is null)
            return Unauthorized(new { message = "Invalid credentials." });

        // The role chosen on the login page must match the account's actual role
        if (!string.IsNullOrEmpty(request.Role) &&
            !user.Role.Equals(request.Role, StringComparison.OrdinalIgnoreCase))
            return Unauthorized(new { message = $"This account is not registered as {request.Role}." });

        var token = _tokens.GenerateToken(user.Username, user.Role);

        return Ok(new LoginResponseDTO
        {
            Token = token,
            Username = user.Username,
            Role = user.Role
        });
    }

    // GET api/auth/profile -- current user's account information
    [Authorize]
    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        var name = User.Identity?.Name;
        var user = name is null ? null : _users.Find(name);
        if (user is null) return NotFound(new { message = "User not found." });

        return Ok(new
        {
            user.Username,
            user.Role,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.DateOfBirth,
            user.Gender,
            user.CreatedAt
        });
    }

    // PUT api/auth/profile -- update current user's account information
    [Authorize]
    [HttpPut("profile")]
    public IActionResult UpdateProfile([FromBody] UpdateProfileDTO dto)
    {
        var name = User.Identity?.Name;
        if (name is null) return Unauthorized(new { message = "Not signed in." });

        if (string.IsNullOrWhiteSpace(dto.FullName))
            return BadRequest(new { message = "Full name is required." });

        if (string.IsNullOrWhiteSpace(dto.Email) || !dto.Email.Contains('@'))
            return BadRequest(new { message = "A valid email is required." });

        var ok = _users.UpdateProfile(
            name,
            dto.FullName.Trim(),
            dto.Email.Trim(),
            dto.PhoneNumber.Trim(),
            dto.DateOfBirth.Trim(),
            dto.Gender.Trim());

        if (!ok) return NotFound(new { message = "User not found." });

        return Ok(new { message = "Profile updated successfully." });
    }

    // GET api/auth/dashboard -- any authenticated user
    [Authorize]
    [HttpGet("dashboard")]
    public IActionResult Dashboard()
    {
        var name = User.Identity?.Name ?? "stranger";
        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Unknown";
        return Ok(new { message = $"Hello, {name}! You are logged in as {role}.", role });
    }
}