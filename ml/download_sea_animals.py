# pyrefly: ignore [missing-import]
import kagglehub

print("Starting download of 'vencerlanz09/sea-animals-image-dataste'...")
path = kagglehub.dataset_download("vencerlanz09/sea-animals-image-dataste")

print("Download complete!")
print("Path to dataset files:", path)
