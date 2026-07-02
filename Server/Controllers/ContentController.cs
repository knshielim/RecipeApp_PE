using Server.DTO;
using Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ServerApi.Controllers;

/// <summary>
/// Content endpoints for authenticated users (any role).
/// Users create and see their own content; admins see everything
/// through /api/admin/content.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ContentController : ControllerBase
{
    private readonly ContentStore _content;
    public ContentController(ContentStore content) => _content = content;

    // GET api/content/mine
    [HttpGet("mine")]
    public IActionResult Mine()
    {
        var me = User.Identity?.Name ?? "";
        return Ok(_content.GetByAuthor(me));
    }

    // POST api/content
    [HttpPost]
    public IActionResult Create([FromBody] ContentRequestDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Title is required." });

        var me = User.Identity?.Name ?? "unknown";
        var item = _content.Add(dto.Title.Trim(), dto.Body?.Trim() ?? "", me);
        return Ok(item);
    }
}
