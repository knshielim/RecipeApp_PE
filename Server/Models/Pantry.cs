public class Pantry
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string IngredientName { get; set; } = "";
    public string Category { get; set; } = ""; // e.g., "Vegetables", "Proteins", "Dairy", "Spices"
    public int Quantity { get; set; } = 1;
    public string Unit { get; set; } = ""; // e.g., "kg", "pieces", "cups"
    public DateTime ExpiryDate { get; set; }
}
