# Renders tools/gerrygram/gerrygram.html (from make.mjs) at twice its size to site/public/img/somevotes-gerrygram.png,
# 2400 by 1720 pixels for articles, and a 1200 pixels wide WebP of it for the page. Needs Edge and FFmpeg on the PATH.
# Run from the repository root: node tools/gerrygram/make.mjs; powershell -File tools/gerrygram/render.ps1
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$img = Join-Path $here '..\..\site\public\img' | Resolve-Path
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$page = 'file:///' + ((Join-Path $here 'gerrygram.html') -replace '\\', '/')
$png = Join-Path $img 'somevotes-gerrygram.png'
& $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 "--user-data-dir=$env:TEMP\gerrygram-edge" `
  '--window-size=1200,860' "--screenshot=$png" $page 2>$null | Out-Null
ffmpeg -loglevel error -y -i $png -vf 'scale=1200:-1:flags=lanczos' -c:v libwebp -quality 82 -compression_level 6 (Join-Path $img 'somevotes-gerrygram.webp')
Get-Item (Join-Path $img 'somevotes-gerrygram.*') | Select-Object Name, Length
