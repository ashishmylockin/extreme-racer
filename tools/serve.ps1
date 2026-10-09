# A tiny local web server for testing (the same job as VS Code's Live Server). Usage: powershell -File tools/serve.ps1 [port]
param([int]$Port = 5500)
$root = (Resolve-Path "$PSScriptRoot\..").Path
$types = @{ ".html"="text/html"; ".js"="text/javascript"; ".css"="text/css"; ".json"="application/json"; ".glb"="model/gltf-binary"; ".hdr"="application/octet-stream"; ".png"="image/png"; ".jpg"="image/jpeg"; ".webp"="image/webp"; ".wasm"="application/wasm"; ".md"="text/plain" }
$l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$Port/"); $l.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"
while ($l.IsListening) {
  $c = $l.GetContext(); $p = $c.Request.Url.LocalPath; if ($p -eq "/") { $p = "/index.html" }
  $f = Join-Path $root ($p.TrimStart("/") -replace "/", "\")
  if ((Test-Path $f -PathType Leaf) -and $f.StartsWith($root)) {
    $b = [IO.File]::ReadAllBytes($f); $e = [IO.Path]::GetExtension($f).ToLower()
    $c.Response.ContentType = $(if ($types[$e]) { $types[$e] } else { "application/octet-stream" }); $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
