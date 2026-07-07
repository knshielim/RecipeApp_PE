namespace Server.Services;

public static class UserIdResolver
{
    public static int GetUserId(string username) => username.Trim().ToLowerInvariant() switch
    {
        "alice" => 1,
        "bob" => 2,
        "admin" => 0,
        _ => 1
    };
}
