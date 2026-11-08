# _planpng.ps1 - paints tools/scratch/_planjson.mjs's draw commands to a PNG with System.Drawing
# (no browser). powershell -File tools/scratch/_planpng.ps1 <in.json> <out.png>
param([string]$in, [string]$out)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$plan = Get-Content $in -Raw | ConvertFrom-Json
$bmp = New-Object System.Drawing.Bitmap ([int]$plan.w), ([int]$plan.h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#cfe3c0'))
$font = New-Object System.Drawing.Font 'Arial', 9
function Pts($list) { [System.Drawing.PointF[]]($list | ForEach-Object { New-Object System.Drawing.PointF ([single]$_[0]), ([single]$_[1]) }) }
foreach ($c in $plan.cmds) {
  $col = [System.Drawing.ColorTranslator]::FromHtml($c.col)
  if ($c.t -eq 'line') {
    $pen = New-Object System.Drawing.Pen $col, ([single][math]::Max(1, $c.w))
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $p = Pts $c.pts
    if ($p.Length -ge 2) { $g.DrawLines($pen, $p) }
    $pen.Dispose()
  } elseif ($c.t -eq 'poly') {
    $brush = New-Object System.Drawing.SolidBrush $col
    $p = Pts $c.pts
    if ($p.Length -ge 3) { $g.FillPolygon($brush, $p) }
    $brush.Dispose()
  } elseif ($c.t -eq 'dot') {
    $brush = New-Object System.Drawing.SolidBrush $col
    $g.FillRectangle($brush, [single]($c.at[0] - 1.5), [single]($c.at[1] - 1.5), 3, 3)
    $brush.Dispose()
  } elseif ($c.t -eq 'text') {
    $brush = New-Object System.Drawing.SolidBrush $col
    $g.DrawString($c.s, $font, $brush, [single]($c.at[0] + 2), [single]($c.at[1] + 2))
    $brush.Dispose()
  }
}
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"wrote $out"
