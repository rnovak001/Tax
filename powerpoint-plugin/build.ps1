param(
    [Parameter(Mandatory = $true)]
    [string]$InputPptm,

    [string]$OutputPptm
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $InputPptm)) {
    throw "Input .pptm not found: $InputPptm"
}

if (-not $OutputPptm) {
    $inputPath = Resolve-Path -LiteralPath $InputPptm
    $inputDir = Split-Path -Parent $inputPath
    $inputBase = [System.IO.Path]::GetFileNameWithoutExtension($inputPath)
    $OutputPptm = Join-Path $inputDir ($inputBase + '.with-ribbon.pptm')
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$customUiSource = Join-Path $scriptDir 'customUI14.xml'
if (-not (Test-Path -LiteralPath $customUiSource)) {
    throw "Missing ribbon XML at: $customUiSource"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
$extractDir = Join-Path $tempRoot 'extract'
$tempZip = Join-Path $tempRoot 'package.zip'

New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

try {
    Copy-Item -LiteralPath $InputPptm -Destination $tempZip -Force
    Expand-Archive -LiteralPath $tempZip -DestinationPath $extractDir -Force

    $customUiDir = Join-Path $extractDir 'customUI'
    New-Item -ItemType Directory -Path $customUiDir -Force | Out-Null
    Copy-Item -LiteralPath $customUiSource -Destination (Join-Path $customUiDir 'customUI14.xml') -Force

    $relsPath = Join-Path $extractDir '_rels/.rels'
    [xml]$relsXml = Get-Content -LiteralPath $relsPath

    $pkgNs = 'http://schemas.openxmlformats.org/package/2006/relationships'
    $relType = 'http://schemas.microsoft.com/office/2007/relationships/ui/extensibility'
    $relTarget = 'customUI/customUI14.xml'

    $existing = $relsXml.Relationships.Relationship | Where-Object {
        $_.Type -eq $relType -or $_.Target -eq $relTarget
    }

    if (-not $existing) {
        $maxId = 0
        foreach ($r in $relsXml.Relationships.Relationship) {
            if ($r.Id -match '^rId(\d+)$') {
                $idNum = [int]$Matches[1]
                if ($idNum -gt $maxId) { $maxId = $idNum }
            }
        }

        $newRel = $relsXml.CreateElement('Relationship', $pkgNs)
        $newRel.SetAttribute('Id', ('rId' + ($maxId + 1)))
        $newRel.SetAttribute('Type', $relType)
        $newRel.SetAttribute('Target', $relTarget)
        [void]$relsXml.Relationships.AppendChild($newRel)
    }

    $relsXml.Save($relsPath)

    if (Test-Path -LiteralPath $OutputPptm) {
        Remove-Item -LiteralPath $OutputPptm -Force
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($extractDir, $tempZip)
    Copy-Item -LiteralPath $tempZip -Destination $OutputPptm -Force

    Write-Host "Built ribbon-enabled PowerPoint file:" -ForegroundColor Green
    Write-Host "  $OutputPptm"
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
