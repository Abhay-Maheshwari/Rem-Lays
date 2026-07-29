Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("d:\Projects\rem-lays-scaffold\rem-lays\src\assets\logo.png")
$size = [math]::Max($img.Width, $img.Height)
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$x = ($size - $img.Width) / 2
$y = ($size - $img.Height) / 2
$rect = New-Object System.Drawing.Rectangle $x, $y, $img.Width, $img.Height
$g.DrawImage($img, $rect)
$bmp.Save("d:\Projects\rem-lays-scaffold\rem-lays\src\assets\logo_square.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
