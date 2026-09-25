$src = 'd:\SF k'
$destinations = @(
    'd:\sf_server_deploy',
    '\\192.168.0.107\SF\sf_server_deploy'
)

foreach ($dst in $destinations) {
    Write-Host "Syncing to $dst ..."

    if (!(Test-Path $dst)) {
        Write-Warning "Target path $dst not found!"
        continue
    }

    # 1. Backend src
    robocopy "$src\backend\src" "$dst\backend\src" /MIR /NDL /NFL /NJH /NJS /nc /ns /np
    Write-Host "  Backend src synced"

    # 2. Packages
    robocopy "$src\packages" "$dst\packages" /MIR /NDL /NFL /NJH /NJS /nc /ns /np
    Write-Host "  Packages synced"

    # 3. Frontend src
    robocopy "$src\frontend\src" "$dst\frontend\src" /MIR /NDL /NFL /NJH /NJS /nc /ns /np
    Write-Host "  Frontend src synced"

    # 4. Frontend dist
    robocopy "$src\frontend\dist" "$dst\frontend\dist" /MIR /NDL /NFL /NJH /NJS /nc /ns /np
    Write-Host "  Frontend dist synced"

    # 5. IM images
    robocopy "$src\im" "$dst\im" /E /NDL /NFL /NJH /NJS /nc /ns /np
    robocopy "$src\im" "$dst\data\im" /E /NDL /NFL /NJH /NJS /nc /ns /np
    Write-Host "  IM images synced (im and data/im)"

    # 6. Specific data files
    if (Test-Path "$src\backend\data\npcDeliveries.json") {
        if (!(Test-Path "$dst\backend\data")) {
            New-Item -ItemType Directory -Path "$dst\backend\data" -Force | Out-Null
        }
        Copy-Item "$src\backend\data\npcDeliveries.json" "$dst\backend\data\npcDeliveries.json" -Force
        Write-Host "  npcDeliveries.json copied"
    }

    # 7. Configs and scripts
    if (Test-Path "$src\docker-compose.yml") {
        Copy-Item "$src\docker-compose.yml" "$dst\docker-compose.yml" -Force
    }
    if (Test-Path "$src\docker-compose.casaos.yml") {
        Copy-Item "$src\docker-compose.casaos.yml" "$dst\docker-compose.casaos.yml" -Force
    }
    if (Test-Path "$src\frontend\nginx.conf") {
        Copy-Item "$src\frontend\nginx.conf" "$dst\frontend\nginx.conf" -Force
    }
    if (Test-Path "$src\restart_backend.sh") {
        Copy-Item "$src\restart_backend.sh" "$dst\restart_backend.sh" -Force
    }
    Write-Host "  Configs and scripts copied"
    Write-Host "Done with $dst"
}

Write-Host "Sync completed."
