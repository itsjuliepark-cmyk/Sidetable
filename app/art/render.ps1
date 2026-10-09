# Renders art/*.svg to the JPEGs the app serves (public/img/<name>.jpg), using Edge or Chrome in headless mode.
#   node art/make-art.js; powershell -NoProfile -ExecutionPolicy Bypass -File art/render.ps1
Add-Type -AssemblyName System.Drawing
$art = $PSScriptRoot
$out = Join-Path (Split-Path -Parent $art) 'public\img'
New-Item -ItemType Directory -Force $out | Out-Null
$browser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Needs Microsoft Edge or Google Chrome.' }
$profile = Join-Path $env:TEMP 'sixtop-art-profile'
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]80)
Get-ChildItem $art -Filter *.svg | ForEach-Object {
  $png = Join-Path $env:TEMP ('sixtop-art-' + $_.BaseName + '.png')
  if (Test-Path $png) { Remove-Item $png }
  $url = 'file:///' + ($_.FullName -replace '\\', '/')
  & $browser --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$profile" --window-size=900,1000 --screenshot="$png" $url 2>$null | Out-Null
  for ($i = 0; $i -lt 40 -and -not (Test-Path $png); $i++) { Start-Sleep -Milliseconds 250 }
  if (-not (Test-Path $png)) { "failed: $($_.Name)"; return }
  $img = [System.Drawing.Image]::FromFile($png)
  $w = 780; $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $dest = Join-Path $out ($_.BaseName + '.jpg')
  $bmp.Save($dest, $codec, $params)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose(); Remove-Item $png
  '{0}.jpg  {1}x{2}  {3:N0} KB' -f $_.BaseName, $w, $h, ((Get-Item $dest).Length / 1KB)
}
