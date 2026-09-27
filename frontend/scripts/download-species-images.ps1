$images = @{}
$images["hawksbill-turtle.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Eretmochelys-imbricata-Kelonia-2.JPG/1280px-Eretmochelys-imbricata-Kelonia-2.JPG"
$images["blue-whale.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg/1280px-Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg"
$images["staghorn-coral.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Hertshoon.jpg/1280px-Hertshoon.jpg"
$images["hammerhead-shark.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Scalloped_Hammerhead_Shark_Sphyrna_Lewini_%28226845659%29.jpeg/1280px-Scalloped_Hammerhead_Shark_Sphyrna_Lewini_%28226845659%29.jpeg"
$images["vaquita.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/3/38/Vaquita6_Olson_NOAA.jpg"
$images["giant-clam.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Giant_clam_%28Tridacna_gigas%29_Michaelmas_Cay.jpg/1280px-Giant_clam_%28Tridacna_gigas%29_Michaelmas_Cay.jpg"
$images["leatherback-turtle.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Leatherback_sea_turtle_Tinglar%2C_USVI_%285839996547%29.jpg/1280px-Leatherback_sea_turtle_Tinglar%2C_USVI_%285839996547%29.jpg"
$images["sea-otter.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/0/02/Sea_Otter_%28Enhydra_lutris%29_%2825169790524%29_crop.jpg"
$images["manta-ray.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/6/6e/Manta_birostris-Thailand.jpg"
$images["clownfish.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Amphiprion_ocellaris_%28Clown_anemonefish%29_by_Nick_Hobgood.jpg/1280px-Amphiprion_ocellaris_%28Clown_anemonefish%29_by_Nick_Hobgood.jpg"
$images["emperor-penguin.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Emperor_Penguin_%28Aptenodytes_forsteri%29_-_Snow_Hill_Island%2C_Antarctica.jpg/1280px-Emperor_Penguin_%28Aptenodytes_forsteri%29_-_Snow_Hill_Island%2C_Antarctica.jpg"
$images["green-turtle.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Green_sea_turtle_%28Chelonia_mydas%29_Sulawesi.jpg/1280px-Green_sea_turtle_%28Chelonia_mydas%29_Sulawesi.jpg"
$images["humpback-whale.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Humpback_Whale_breaching_%28Megaptera_novaeangliae%29.jpg/1280px-Humpback_Whale_breaching_%28Megaptera_novaeangliae%29.jpg"
$images["antarctic-krill.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Krill_%28Euphausia_superba%29_in_the_Antarctic.jpg/1280px-Krill_%28Euphausia_superba%29_in_the_Antarctic.jpg"
$images["lionfish.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Red_Lionfish_%28Pterois_volitans%29.jpg/1280px-Red_Lionfish_%28Pterois_volitans%29.jpg"
$images["right-whale.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/North_Atlantic_right_whale_%28Eubalaena_glacialis%29.jpg/1280px-North_Atlantic_right_whale_%28Eubalaena_glacialis%29.jpg"
$images["crown-of-thorns.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Crown-of-thorns_starfish_%28Acanthaster_planci%29_on_coral.jpg/1280px-Crown-of-thorns_starfish_%28Acanthaster_planci%29_on_coral.jpg"
$images["sleeper-shark.jpg"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Pacific_sleeper_shark_%28Somniosus_pacificus%29.jpg/1280px-Pacific_sleeper_shark_%28Somniosus_pacificus%29.jpg"

$outDir = Join-Path $PSScriptRoot ".." "public" "species"
Write-Host "Downloading species images to: $outDir"
Write-Host "========================================="

foreach ($key in $images.Keys) {
    $url = $images[$key]
    $outPath = Join-Path $outDir $key

    if (Test-Path $outPath) {
        $existingSize = (Get-Item $outPath).Length
        $sizeKB = [math]::Round($existingSize / 1KB)
        Write-Host "[SKIP] $key -- already exists ($sizeKB KB)"
        continue
    }

    Write-Host "[DL]   $key ... " -NoNewline
    Invoke-WebRequest -Uri $url -OutFile $outPath -UserAgent "Mozilla/5.0 (compatible; DeepSeaBot/1.0)" -TimeoutSec 120 -ErrorAction Stop
    $size = (Get-Item $outPath).Length
    $sizeKB = [math]::Round($size / 1KB)
    Write-Host "saved ($sizeKB KB)"
}

Write-Host "========================================="
Write-Host "Download complete!"

