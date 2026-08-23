using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SupportPortal.Data.Migrations
{
    /// <inheritdoc />
    public partial class RestructureSla : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlaPolicyDomains");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "SlaPolicies");

            migrationBuilder.DropColumn(
                name: "ResolutionTimeMinutes",
                table: "SlaPolicies");

            migrationBuilder.DropColumn(
                name: "ResponseTimeMinutes",
                table: "SlaPolicies");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "SlaPolicies",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "SlaPolicyCompanies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    SlaPolicyId = table.Column<int>(type: "int", nullable: false),
                    CompanyId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlaPolicyCompanies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SlaPolicyCompanies_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SlaPolicyCompanies_SlaPolicies_SlaPolicyId",
                        column: x => x.SlaPolicyId,
                        principalTable: "SlaPolicies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "SlaPolicyPriorities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    SlaPolicyId = table.Column<int>(type: "int", nullable: false),
                    Priority = table.Column<string>(type: "varchar(255)", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ResponseTimeMinutes = table.Column<int>(type: "int", nullable: false),
                    ResolutionTimeMinutes = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlaPolicyPriorities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SlaPolicyPriorities_SlaPolicies_SlaPolicyId",
                        column: x => x.SlaPolicyId,
                        principalTable: "SlaPolicies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_SlaPolicyCompanies_CompanyId",
                table: "SlaPolicyCompanies",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_SlaPolicyCompanies_SlaPolicyId_CompanyId",
                table: "SlaPolicyCompanies",
                columns: new[] { "SlaPolicyId", "CompanyId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SlaPolicyPriorities_SlaPolicyId_Priority",
                table: "SlaPolicyPriorities",
                columns: new[] { "SlaPolicyId", "Priority" },
                unique: true);

            // Régi SLA sorok törlése (az előző modellben prioritásonként külön sor volt)
            migrationBuilder.Sql("DELETE FROM `SlaPolicies`;");

            // Seed: "Master SLA" alapértelmezett policy
            migrationBuilder.Sql(@"
                INSERT INTO `SlaPolicies` (`Name`, `IsDefault`, `BusinessHoursOnly`, `CreatedAt`, `UpdatedAt`)
                VALUES ('Master SLA', 1, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());");

            migrationBuilder.Sql(
                "INSERT INTO `SlaPolicyPriorities` (`SlaPolicyId`, `Priority`, `ResponseTimeMinutes`, `ResolutionTimeMinutes`) " +
                "SELECT Id, 'Low', 480, 4320 FROM `SlaPolicies` WHERE `IsDefault` = 1 LIMIT 1;");

            migrationBuilder.Sql(
                "INSERT INTO `SlaPolicyPriorities` (`SlaPolicyId`, `Priority`, `ResponseTimeMinutes`, `ResolutionTimeMinutes`) " +
                "SELECT Id, 'Medium', 240, 1440 FROM `SlaPolicies` WHERE `IsDefault` = 1 LIMIT 1;");

            migrationBuilder.Sql(
                "INSERT INTO `SlaPolicyPriorities` (`SlaPolicyId`, `Priority`, `ResponseTimeMinutes`, `ResolutionTimeMinutes`) " +
                "SELECT Id, 'High', 120, 480 FROM `SlaPolicies` WHERE `IsDefault` = 1 LIMIT 1;");

            migrationBuilder.Sql(
                "INSERT INTO `SlaPolicyPriorities` (`SlaPolicyId`, `Priority`, `ResponseTimeMinutes`, `ResolutionTimeMinutes`) " +
                "SELECT Id, 'Urgent', 30, 240 FROM `SlaPolicies` WHERE `IsDefault` = 1 LIMIT 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlaPolicyCompanies");

            migrationBuilder.DropTable(
                name: "SlaPolicyPriorities");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "SlaPolicies");

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "SlaPolicies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ResolutionTimeMinutes",
                table: "SlaPolicies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ResponseTimeMinutes",
                table: "SlaPolicies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "SlaPolicyDomains",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    SlaPolicyId = table.Column<int>(type: "int", nullable: false),
                    EmailDomain = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlaPolicyDomains", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SlaPolicyDomains_SlaPolicies_SlaPolicyId",
                        column: x => x.SlaPolicyId,
                        principalTable: "SlaPolicies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_SlaPolicyDomains_SlaPolicyId",
                table: "SlaPolicyDomains",
                column: "SlaPolicyId");
        }
    }
}
