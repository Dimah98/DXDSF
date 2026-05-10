$upnp = New-Object -ComObject HNetCfg.NATUPnP
$mappings = $upnp.StaticPortMappingCollection

if ($null -eq $mappings) {
    Write-Host "ERROR: UPnP is disabled on your router. Please enable it in router settings (192.168.0.1)."
    exit 1
}

try {
    # Видаляємо старі порти, якщо вони є
    try { $mappings.Remove(5173, "TCP") } catch {}
    try { $mappings.Remove(3001, "TCP") } catch {}
    try { $mappings.Remove(3002, "TCP") } catch {}

    # Додаємо нові
    $mappings.Add(5173, "TCP", 5173, "192.168.0.100", $true, "SF Bot Frontend")
    $mappings.Add(3001, "TCP", 3001, "192.168.0.100", $true, "SF Bot API")
    $mappings.Add(3002, "TCP", 3002, "192.168.0.100", $true, "SF Bot WS")

    Write-Host "SUCCESS: Ports 5173, 3001, 3002 are now forwarded to 192.168.0.100!"
} catch {
    Write-Host "ERROR: Failed to add port mappings. Reason: $($_.Exception.Message)"
}
