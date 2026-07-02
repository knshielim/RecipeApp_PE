public class Pantry
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string IngredientName { get; set; } = "";
    public string Category { get; set; } = "";
    public int Quantity { get; set; } = 1;
    public string Unit { get; set; } = "";
    public DateTime ExpiryDate { get; set; }
}