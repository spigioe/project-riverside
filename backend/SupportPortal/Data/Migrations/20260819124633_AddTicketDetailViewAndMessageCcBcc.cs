using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SupportPortal.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTicketDetailViewAndMessageCcBcc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "TicketDetailSplitReversed",
                table: "UserPreferences",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            // A MySQL/Pomelo nem támogat konstans DEFAULT-ot longtext oszlopon (lásd figyelmeztetés
            // migráció futtatásakor) — a lenti defaultValue emiatt figyelmen kívül marad, a meglévő
            // sorok üres string-et kapnának, ami érvénytelen az enum string-konverzióhoz. Ezért explicit
            // UPDATE-tel töltjük fel a meglévő sorokat 'Classic'-ra.
            migrationBuilder.AddColumn<string>(
                name: "TicketDetailView",
                table: "UserPreferences",
                type: "longtext",
                nullable: false,
                defaultValue: "Classic")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("UPDATE `UserPreferences` SET `TicketDetailView` = 'Classic' WHERE `TicketDetailView` = '' OR `TicketDetailView` IS NULL;");

            migrationBuilder.AddColumn<string>(
                name: "Bcc",
                table: "TicketMessages",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Cc",
                table: "TicketMessages",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TicketDetailSplitReversed",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "TicketDetailView",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "Bcc",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "Cc",
                table: "TicketMessages");
        }
    }
}
