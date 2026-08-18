FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY SupportPortal/*.csproj SupportPortal/
RUN dotnet restore SupportPortal/SupportPortal.csproj
COPY SupportPortal/ SupportPortal/
RUN dotnet publish SupportPortal/SupportPortal.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "SupportPortal.dll"]
