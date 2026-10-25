# ECOnomy - Local Server & Launcher
param(
    [int]$Port = 8080,
    [switch]$BrowserOnly
)

$currentDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$htmlFile = Join-Path $currentDir "index.html"

if ($BrowserOnly) {
    Write-Host "Opening $htmlFile in default web browser..." -ForegroundColor Green
    Start-Process $htmlFile
    exit 0
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ECOnomy - Circular E-Commerce Platform" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Serving files from: $currentDir" -ForegroundColor Yellow
Write-Host "URL: http://localhost:$Port/" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Launch browser
Start-Process "http://localhost:$Port/"

# Simple .NET HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($urlPath)) {
            $urlPath = "index.html"
        }

        $filePath = Join-Path $currentDir $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($extension) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
        }
        $response.Close()
    }
} catch {
    Write-Host "Server stopped: $_" -ForegroundColor Yellow
} finally {
    $listener.Stop()
    $listener.Close()
}
