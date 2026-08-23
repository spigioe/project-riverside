using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SupportPortal.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRawEmailParts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RawEmailParts",
                table: "TicketMessages",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RawEmailParts",
                table: "TicketMessages");
        }
    }
}
