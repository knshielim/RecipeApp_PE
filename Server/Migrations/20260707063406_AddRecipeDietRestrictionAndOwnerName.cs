using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddRecipeDietRestrictionAndOwnerName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DietRestriction",
                table: "Recipes",
                type: "TEXT",
                nullable: false,
                defaultValue: "none");

            migrationBuilder.AddColumn<string>(
                name: "OwnerName",
                table: "Recipes",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE Recipes
                SET OwnerName = COALESCE(
                    (SELECT FullName FROM Users WHERE lower(Users.Username) = lower(Recipes.OwnerUsername)),
                    OwnerUsername
                )
                WHERE OwnerName = '';
                """);

            migrationBuilder.DropColumn(
                name: "WriterUsername",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "OwnerUsername",
                table: "Recipes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OwnerUsername",
                table: "Recipes",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "WriterUsername",
                table: "Recipes",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE Recipes
                SET OwnerUsername = COALESCE(
                    (SELECT Username FROM Users WHERE Users.FullName = Recipes.OwnerName),
                    OwnerName
                );
                """);

            migrationBuilder.DropColumn(
                name: "DietRestriction",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "OwnerName",
                table: "Recipes");
        }
    }
}
