using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SupportPortal.Data.Migrations
{
    /// <inheritdoc />
    public partial class ExpandDashboardWidgets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PositionX",
                table: "DashboardWidgets",
                newName: "Col");

            migrationBuilder.RenameColumn(
                name: "PositionY",
                table: "DashboardWidgets",
                newName: "Row");

            migrationBuilder.RenameColumn(
                name: "Width",
                table: "DashboardWidgets",
                newName: "ColSpan");

            migrationBuilder.RenameColumn(
                name: "Height",
                table: "DashboardWidgets",
                newName: "RowSpan");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Col",
                table: "DashboardWidgets",
                newName: "PositionX");

            migrationBuilder.RenameColumn(
                name: "Row",
                table: "DashboardWidgets",
                newName: "PositionY");

            migrationBuilder.RenameColumn(
                name: "ColSpan",
                table: "DashboardWidgets",
                newName: "Width");

            migrationBuilder.RenameColumn(
                name: "RowSpan",
                table: "DashboardWidgets",
                newName: "Height");
        }
    }
}
