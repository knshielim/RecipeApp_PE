public class UserPreference
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Goal { get; set; } = "maintain";      // "cutting", "bulking", "maintain"
    public string DietType { get; set; } = "none";       // "vegetarian", "vegan", "halal", "none", etc.
    public string Allergies { get; set; } = "";           // comma-separated, e.g. "peanuts, shellfish"
}