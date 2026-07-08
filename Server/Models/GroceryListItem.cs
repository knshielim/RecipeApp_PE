namespace Server.Models;

public class GroceryListItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateOnly WeekStartDate { get; set; }
    public string Name { get; set; } = "";
    public double Quantity { get; set; }
    public string Unit { get; set; } = "";
    public int Occurrences { get; set; }
    public bool IsChecked { get; set; }

    // True for items the user added by hand; they survive a regenerate.
    public bool IsCustom { get; set; }
}
