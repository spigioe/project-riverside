using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SupportPortal.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageSourceTicketId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SourceTicketId",
                table: "TicketMessages",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TicketMessages_SourceTicketId",
                table: "TicketMessages",
                column: "SourceTicketId");

            migrationBuilder.AddForeignKey(
                name: "FK_TicketMessages_Tickets_SourceTicketId",
                table: "TicketMessages",
                column: "SourceTicketId",
                principalTable: "Tickets",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TicketMessages_Tickets_SourceTicketId",
                table: "TicketMessages");

            migrationBuilder.DropIndex(
                name: "IX_TicketMessages_SourceTicketId",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "SourceTicketId",
                table: "TicketMessages");
        }
    }
}
