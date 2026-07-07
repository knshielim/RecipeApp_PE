namespace Server.Services;

public static class WeekDateHelper
{
    public static DateOnly CurrentMonday(DateOnly? from = null)
    {
        var date = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var offset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offset);
    }

    public static DateOnly ParseOrCurrent(string? weekStart)
    {
        if (!string.IsNullOrWhiteSpace(weekStart) &&
            DateOnly.TryParse(weekStart, out var parsed))
        {
            return CurrentMonday(parsed);
        }

        return CurrentMonday();
    }

    public static string FormatLabel(DateOnly weekStart)
    {
        var end = weekStart.AddDays(6);
        return $"{weekStart:MMM d} – {end:MMM d, yyyy}";
    }
}
