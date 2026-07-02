using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.DTO;
using Server.Services; 

namespace ServerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly UserStore _users;
    private readonly ContentStore _content;

    public AdminController(UserStore users, ContentStore content)
    {
        _users = users;
        _content = content;
    }

    // GET api/admin/users
    [HttpGet("users")]
    public IActionResult GetUsers()
    {
        var users = _users.GetAll()
            .Select(u => new
            {
                u.Username,
                u.Role,
                u.CreatedAt,
                u.FullName,
                u.Email,
                u.PhoneNumber,
                u.DateOfBirth,
                u.Gender
            });
        return Ok(users);
    }

    // DELETE api/admin/users/{username}
    [HttpDelete("users/{username}")]
    public IActionResult DeleteUser(string username)
    {
        var me = User.Identity?.Name;
        if (string.Equals(me, username, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "You cannot delete your own account." });

        if (!_users.Remove(username))
            return NotFound(new { message = "User not found." });

        return Ok(new { message = $"User '{username}' deleted." });
    }

    // PUT api/admin/users/{username}/role
    [HttpPut("users/{username}/role")]
    public IActionResult UpdateRole(string username, [FromBody] UpdateRoleDTO dto)
    {
        if (dto.Role != "Admin" && dto.Role != "User")
            return BadRequest(new { message = "Role must be 'Admin' or 'User'." });

        var me = User.Identity?.Name;
        if (string.Equals(me, username, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "You cannot change your own role." });

        if (!_users.UpdateRole(username, dto.Role))
            return NotFound(new { message = "User not found." });

        return Ok(new { message = $"'{username}' is now {dto.Role}." });
    }

    // PUT api/admin/users/{username}/profile -- admin edits any user's information
    [HttpPut("users/{username}/profile")]
    public IActionResult UpdateUserProfile(string username, [FromBody] AdminUpdateUserDTO dto)
    {
        var user = _users.Find(username);
        if (user is null)
            return NotFound(new { message = "User not found." });

        if (string.IsNullOrWhiteSpace(dto.FullName))
            return BadRequest(new { message = "Full name is required." });

        if (string.IsNullOrWhiteSpace(dto.Email) || !dto.Email.Contains('@'))
            return BadRequest(new { message = "A valid email is required." });

        if (!string.IsNullOrWhiteSpace(dto.NewPassword) && dto.NewPassword.Length < 6)
            return BadRequest(new { message = "New password must be at least 6 characters." });

        _users.UpdateProfile(
            username,
            dto.FullName.Trim(),
            dto.Email.Trim(),
            dto.PhoneNumber.Trim(),
            dto.DateOfBirth.Trim(),
            dto.Gender.Trim());

        if (!string.IsNullOrWhiteSpace(dto.NewPassword))
            _users.SetPassword(username, dto.NewPassword);

        return Ok(new { message = $"Information for '{username}' updated." });
    }

    // GET api/admin/content
    [HttpGet("content")]
    public IActionResult GetAllContent() => Ok(_content.GetAll());

    // DELETE api/admin/content/{id}
    [HttpDelete("content/{id:int}")]
    public IActionResult DeleteContent(int id)
    {
        if (!_content.Delete(id))
            return NotFound(new { message = "Content not found." });
            
        return Ok(new { message = "Content deleted." });
    }
}
