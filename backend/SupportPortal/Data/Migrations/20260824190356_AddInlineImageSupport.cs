using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SupportPortal.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInlineImageSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FileStorages_TicketMessages_MessageId",
                table: "FileStorages");

            migrationBuilder.AlterColumn<string>(
                name: "OriginalFilename",
                table: "FileStorages",
                type: "varchar(512)",
                maxLength: 512,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "ObjectKey",
                table: "FileStorages",
                type: "varchar(1024)",
                maxLength: 1024,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "MimeType",
                table: "FileStorages",
                type: "varchar(256)",
                maxLength: 256,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<int>(
                name: "MessageId",
                table: "FileStorages",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "BucketOrPath",
                table: "FileStorages",
                type: "varchar(256)",
                maxLength: 256,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ContentId",
                table: "FileStorages",
                type: "varchar(512)",
                maxLength: 512,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "IsInline",
                table: "FileStorages",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "TicketId",
                table: "FileStorages",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TicketMessageId",
                table: "FileStorages",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FileStorages_TicketId",
                table: "FileStorages",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_FileStorages_TicketMessageId",
                table: "FileStorages",
                column: "TicketMessageId");

            migrationBuilder.AddForeignKey(
                name: "FK_FileStorages_TicketMessages_MessageId",
                table: "FileStorages",
                column: "MessageId",
                principalTable: "TicketMessages",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_FileStorages_TicketMessages_TicketMessageId",
                table: "FileStorages",
                column: "TicketMessageId",
                principalTable: "TicketMessages",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FileStorages_Tickets_TicketId",
                table: "FileStorages",
                column: "TicketId",
                principalTable: "Tickets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FileStorages_TicketMessages_MessageId",
                table: "FileStorages");

            migrationBuilder.DropForeignKey(
                name: "FK_FileStorages_TicketMessages_TicketMessageId",
                table: "FileStorages");

            migrationBuilder.DropForeignKey(
                name: "FK_FileStorages_Tickets_TicketId",
                table: "FileStorages");

            migrationBuilder.DropIndex(
                name: "IX_FileStorages_TicketId",
                table: "FileStorages");

            migrationBuilder.DropIndex(
                name: "IX_FileStorages_TicketMessageId",
                table: "FileStorages");

            migrationBuilder.DropColumn(
                name: "ContentId",
                table: "FileStorages");

            migrationBuilder.DropColumn(
                name: "IsInline",
                table: "FileStorages");

            migrationBuilder.DropColumn(
                name: "TicketId",
                table: "FileStorages");

            migrationBuilder.DropColumn(
                name: "TicketMessageId",
                table: "FileStorages");

            migrationBuilder.AlterColumn<string>(
                name: "OriginalFilename",
                table: "FileStorages",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(512)",
                oldMaxLength: 512)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "ObjectKey",
                table: "FileStorages",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(1024)",
                oldMaxLength: 1024)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "MimeType",
                table: "FileStorages",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(256)",
                oldMaxLength: 256)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<int>(
                name: "MessageId",
                table: "FileStorages",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "BucketOrPath",
                table: "FileStorages",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(256)",
                oldMaxLength: 256)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddForeignKey(
                name: "FK_FileStorages_TicketMessages_MessageId",
                table: "FileStorages",
                column: "MessageId",
                principalTable: "TicketMessages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
