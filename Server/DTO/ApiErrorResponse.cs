namespace Server.DTO;

public class ApiErrorResponse
{
    public int StatusCode { get; set; }
    public string Message { get; set; } = "";
    public Dictionary<string, string[]>? Errors { get; set; }
    public string? TraceId { get; set; }
}