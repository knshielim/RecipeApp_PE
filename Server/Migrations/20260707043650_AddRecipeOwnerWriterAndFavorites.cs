using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddRecipeOwnerWriterAndFavorites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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

            migrationBuilder.CreateTable(
                name: "FavoriteRecipes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Username = table.Column<string>(type: "TEXT", nullable: false),
                    RecipeId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FavoriteRecipes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FavoriteRecipes_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FavoriteRecipes_RecipeId",
                table: "FavoriteRecipes",
                column: "RecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_FavoriteRecipes_Username_RecipeId",
                table: "FavoriteRecipes",
                columns: new[] { "Username", "RecipeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FavoriteRecipes");

            migrationBuilder.DropColumn(
                name: "OwnerUsername",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "WriterUsername",
                table: "Recipes");
        }
    }
}
