Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("d:\Projects\rem-lays-scaffold\rem-lays\src-tauri\icons\icon.png")
$size = [math]::Min($img.Width, $img.Height)
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
$g.DrawImage($img, $rect, 0, 0, $size, $size, [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save("d:\Projects\rem-lays-scaffold\rem-lays\src-tauri\icons\icon_square.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
Move-Item -Force "d:\Projects\rem-lays-scaffold\rem-lays\src-tauri\icons\icon_square.png" "d:\Projects\rem-lays-scaffold\rem-lays\src-tauri\icons\icon.png"
