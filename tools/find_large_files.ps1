Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 20 FullName, @{Name="MB";Expression={"{0:N2}" -f ($_.Length / 1MB)}}

Write-Host "--- TOP FOLDERS ---"
$startFolder = Get-Location
$colItems = (Get-ChildItem $startFolder | Where-Object {$_.PSIsContainer -eq $True})
foreach ($i in $colItems)
{
    $subFolderItems = (Get-ChildItem $i.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -property length -sum)
    $FileSize = "{0:N2}" -f ($subFolderItems.sum / 1MB)
    Write-Host "$FileSize MB : " $i.FullName
}
