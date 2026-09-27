# pyrefly: ignore [missing-import]
import kagglehub

print("Starting download of 'jboysen/sf-beaches-water'...")
path = kagglehub.dataset_download("jboysen/sf-beaches-water")

print("Download complete!")
print("Path to dataset files:", path)
