using Microsoft.EntityFrameworkCore;
using Server.Models;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<MealPlan> MealPlans => Set<MealPlan>();
    public DbSet<UserPreference> UserPreferences => Set<UserPreference>();
    public DbSet<Pantry> Pantries => Set<Pantry>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RecipeCategory> RecipeCategories => Set<RecipeCategory>();
    public DbSet<FavoriteRecipe> FavoriteRecipes => Set<FavoriteRecipe>();
    public DbSet<RecipeCategoryAssignment> RecipeCategoryAssignments => Set<RecipeCategoryAssignment>();
    public DbSet<GroceryListItem> GroceryListItems => Set<GroceryListItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Username);
            entity.Property(u => u.Username).HasMaxLength(100);
            entity.Property(u => u.PasswordHash).IsRequired();
            entity.Property(u => u.Role).IsRequired();
            entity.Property(u => u.ProfilePicture).HasDefaultValue(string.Empty);
            entity.Property(u => u.IsActive).HasDefaultValue(true);
        });

        modelBuilder.Entity<FavoriteRecipe>(entity =>
        {
            entity.HasKey(f => f.Id);

            entity.HasIndex(f => new { f.Username, f.RecipeId })
                .IsUnique();

            entity.HasOne(f => f.Recipe)
                .WithMany()
                .HasForeignKey(f => f.RecipeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RecipeCategory>(entity =>
        {
            entity.Property(c => c.Name).IsRequired();
            entity.Property(c => c.Emoji).HasDefaultValue("🍽️");
            entity.Property(c => c.ColorKey).HasDefaultValue("amber");
        });

        modelBuilder.Entity<GroceryListItem>(entity =>
        {
            entity.HasKey(g => g.Id);
            entity.Property(g => g.Name).IsRequired().HasMaxLength(120);
            entity.Property(g => g.Unit).HasMaxLength(20);
            entity.HasIndex(g => new { g.UserId, g.WeekStartDate });
        });

        modelBuilder.Entity<RecipeCategoryAssignment>(entity =>
        {
            entity.HasKey(rca => rca.Id);

            entity.HasIndex(rca => new { rca.RecipeId, rca.RecipeCategoryId })
                .IsUnique();

            entity.HasOne(rca => rca.Recipe)
                .WithMany(r => r.CategoryAssignments)
                .HasForeignKey(rca => rca.RecipeId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(rca => rca.RecipeCategory)
                .WithMany()
                .HasForeignKey(rca => rca.RecipeCategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
