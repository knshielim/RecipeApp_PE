using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.DTO;
using Server.Models;
using Server.Services;

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
        // DTO validation already checks:
        // Username, Password, FullName, Email, PhoneNumber, DateOfBirth, Gender.

        var user = new User
        {
            Username = request.Username.Trim(),
            PasswordHash = UserStore.Hash(request.Password),
            Role = "User", // Public registration should only create standard users.
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            DateOfBirth = request.DateOfBirth.Trim(),
            Gender = request.Gender.Trim()
        };

        if (!_users.Add(user))
        {
            return ErrorResponse(
                StatusCodes.Status409Conflict,
                "Username is already taken.");
        }

        return Ok(new
        {
            message = $"Account '{user.Username}' created successfully. You can now log in."
        });
    }

    // POST api/auth/login
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequestDTO request)
    {
        // DTO validation already checks:
        // Username, Password, Role.

        var username = request.Username.Trim();

        if (!_users.Verify(username, request.Password, out var user) || user is null)
        {
            return ErrorResponse(
                StatusCodes.Status401Unauthorized,
                "Invalid username or password.");
        }

        if (!user.IsActive)
        {
            return ErrorResponse(
                StatusCodes.Status401Unauthorized,
                "This account has been deactivated. Please contact an administrator.");
        }

        // The role chosen on the login page must match the account's actual role.
        if (!user.Role.Equals(request.Role, StringComparison.OrdinalIgnoreCase))
        {
            return ErrorResponse(
                StatusCodes.Status401Unauthorized,
                $"This account is not registered as {request.Role}.");
        }

        var token = _tokens.GenerateToken(user.Username, user.Role);

        return Ok(new LoginResponseDTO
        {
            Token = token,
            Username = user.Username,
            Role = user.Role
        });
    }

    // GET api/auth/profile
    [Authorize]
    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        var name = User.Identity?.Name;

        if (string.IsNullOrWhiteSpace(name))
        {
            return ErrorResponse(
                StatusCodes.Status401Unauthorized,
                "Not signed in.");
        }

        var user = _users.Find(name);

        if (user is null)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "User not found.");
        }

        return Ok(new
        {
            user.Username,
            user.Role,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.DateOfBirth,
            user.Gender,
            user.CreatedAt,
            profilePicture = string.IsNullOrEmpty(user.ProfilePicture) ? null : user.ProfilePicture
        });
    }

    // PUT api/auth/profile
    [Authorize]
    [HttpPut("profile")]
    public IActionResult UpdateProfile([FromBody] UpdateProfileDTO dto)
    {
        // DTO validation already checks:
        // FullName and Email required,
        // Email format,
        // optional PhoneNumber, DateOfBirth, and Gender format.

        var name = User.Identity?.Name;

        if (string.IsNullOrWhiteSpace(name))
        {
            return ErrorResponse(
                StatusCodes.Status401Unauthorized,
                "Not signed in.");
        }

        var ok = _users.UpdateProfile(
            name,
            dto.FullName.Trim(),
            dto.Email.Trim(),
            dto.PhoneNumber.Trim(),
            dto.DateOfBirth.Trim(),
            dto.Gender.Trim());

        if (!ok)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "User not found.");
        }

        return Ok(new { message = "Profile updated successfully." });
    }

    // PUT api/auth/profile/picture
    [Authorize]
    [HttpPut("profile/picture")]
    public IActionResult UpdateProfilePicture([FromBody] UpdateProfilePictureDTO dto)
    {
        var name = User.Identity?.Name;

        if (string.IsNullOrWhiteSpace(name))
        {
            return ErrorResponse(
                StatusCodes.Status401Unauthorized,
                "Not signed in.");
        }

        var picture = dto.ProfilePicture?.Trim();

        if (!string.IsNullOrEmpty(picture))
        {
            if (!picture.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            {
                return ErrorResponse(
                    StatusCodes.Status400BadRequest,
                    "Profile picture must be a valid image.");
            }

            if (picture.Length > 600_000)
            {
                return ErrorResponse(
                    StatusCodes.Status400BadRequest,
                    "Profile picture is too large. Please use a smaller image.");
            }
        }

        var ok = _users.UpdateProfilePicture(name, picture);

        if (!ok)
        {
            return ErrorResponse(
                StatusCodes.Status404NotFound,
                "User not found.");
        }

        return Ok(new
        {
            message = string.IsNullOrEmpty(picture)
                ? "Profile picture removed."
                : "Profile picture updated.",
            profilePicture = string.IsNullOrEmpty(picture) ? null : picture
        });
    }

    // GET api/auth/dashboard
    [Authorize]
    [HttpGet("dashboard")]
    public IActionResult Dashboard()
    {
        var name = User.Identity?.Name ?? "stranger";
        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Unknown";

        return Ok(new
        {
            message = $"Hello, {name}! You are logged in as {role}.",
            role
        });
    }

    private ObjectResult ErrorResponse(int statusCode, string message)
    {
        return StatusCode(statusCode, new ApiErrorResponse
        {
            StatusCode = statusCode,
            Message = message,
            TraceId = HttpContext.TraceIdentifier
        });
    }
}