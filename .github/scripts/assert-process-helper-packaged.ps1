$helper = Get-ChildItem ".\out" -Recurse -Filter "hinekora-poe-process-helper.exe" |
  Where-Object { $_.FullName -like "*\resources\poe-process-helper\hinekora-poe-process-helper.exe" } |
  Select-Object -First 1

if (-not $helper) {
  Write-Host "::error::PoE process helper was not packaged under resources\poe-process-helper"
  exit 1
}

Write-Host "PoE process helper packaged at $($helper.FullName)"
