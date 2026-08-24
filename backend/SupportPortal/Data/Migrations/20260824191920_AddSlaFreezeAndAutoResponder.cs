using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SupportPortal.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSlaFreezeAndAutoResponder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SlaPausedAt",
                table: "Tickets",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AutoResponderTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Trigger = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SubjectTemplate = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BodyTemplate = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsEnabled = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AutoResponderTemplates", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "SlaFreezeStatuses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    StatusKey = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FreezeEnabled = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlaFreezeStatuses", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            // Seed: SLA fagyasztás státuszok
            migrationBuilder.InsertData(
                table: "SlaFreezeStatuses",
                columns: ["StatusKey", "FreezeEnabled"],
                values: new object[,]
                {
                    { "New", false },
                    { "Open", false },
                    { "Pending", true },
                    { "Resolved", false },
                    { "Closed", false },
                });

            // Seed: alapértelmezett auto-responder sablon
            migrationBuilder.InsertData(
                table: "AutoResponderTemplates",
                columns: ["Trigger", "SubjectTemplate", "BodyTemplate", "IsEnabled", "CreatedAt"],
                values: new object[]
                {
                    "new_ticket",
                    "Megkaptuk megkeresését – #{{ticket.id}}: {{ticket.subject}}",
                    "Kedves {{contact.name}},\n\nKöszönjük megkeresését! Jegyét rögzítettük (#{{ticket.id}}).\nHamarosan felvesszük Önnel a kapcsolatot.\n\nÜdvözlettel,\nSupport Team\n\n{{portal.url}}/tickets/{{ticket.id}}",
                    true,
                    new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AutoResponderTemplates");

            migrationBuilder.DropTable(
                name: "SlaFreezeStatuses");

            migrationBuilder.DropColumn(
                name: "SlaPausedAt",
                table: "Tickets");
        }
    }
}
