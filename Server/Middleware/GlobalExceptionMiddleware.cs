using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Server.DTO;

namespace Server.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Database update error occurred.");

            await WriteErrorResponseAsync(
                context,
                StatusCodes.Status500InternalServerError,
                "A database error occurred. Please try again later.");
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid request argument.");

            await WriteErrorResponseAsync(
                context,
                StatusCodes.Status400BadRequest,
                ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access.");

            await WriteErrorResponseAsync(
                context,
                StatusCodes.Status401Unauthorized,
                "You are not authorized to perform this action.");
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Requested resource was not found.");

            await WriteErrorResponseAsync(
                context,
                StatusCodes.Status404NotFound,
                ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled server error.");

            await WriteErrorResponseAsync(
                context,
                StatusCodes.Status500InternalServerError,
                "Something went wrong on the server. Please try again later.");
        }
    }

    private static async Task WriteErrorResponseAsync(
        HttpContext context,
        int statusCode,
        string message)
    {
        if (context.Response.HasStarted)
            return;

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var response = new ApiErrorResponse
        {
            StatusCode = statusCode,
            Message = message,
            TraceId = context.TraceIdentifier
        };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}