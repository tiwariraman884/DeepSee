"""
Phase 4 (v2): Train Marine Species Classifier via Transfer Learning
====================================================================

Replaces the original hand-crafted-feature approach (32x32 raw pixels + colour
histogram -> Random Forest), which reached only ~27% validation accuracy. The
root cause was that 32x32 downscaling destroys the shape information needed to
tell a whale from a shark, and 3,096 raw-pixel features over ~2,300 samples
simply memorised the training set (100% train / 27% val).

This version fine-tunes a pretrained MobileNetV3-Small backbone:
  * ImageNet weights already encode edges, textures and shapes
  * Images are used at 224x224 instead of 32x32
  * Only the classifier head is trained in stage 1; the last backbone block is
    unfrozen for a short stage 2 to adapt to underwater imagery
  * Class imbalance is handled with inverse-frequency class weights

Runs on CPU in a reasonable time. Produces:
  * species_classifier.pt          - PyTorch state dict + metadata
  * species_classifier_metrics.json - honest train/validation metrics

Usage:
  python train_species_classifier_v2.py [--epochs 6] [--batch-size 32] [--quick]
"""
import os, json, glob, time, argparse, random
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms, models
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = r"C:\Users\Lenovo\.cache\kagglehub\datasets\vencerlanz09\sea-animals-image-dataste\versions\5"
MODEL_OUT = os.path.join(BASE_DIR, "species_classifier.pt")
METRICS_OUT = os.path.join(BASE_DIR, "species_classifier_metrics.json")

IMG_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
SEED = 42


def set_seed(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


class MarineDataset(Dataset):
    """Loads image paths from memory; decoding happens lazily per batch."""

    def __init__(self, paths, labels, transform):
        self.paths = paths
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        try:
            img = Image.open(self.paths[idx]).convert("RGB")
        except Exception:
            # A corrupt image must not kill the run; substitute a black frame.
            img = Image.new("RGB", (IMG_SIZE, IMG_SIZE), (0, 0, 0))
        return self.transform(img), self.labels[idx]


def build_model(num_classes):
    """MobileNetV3-Small with a fresh classifier head."""
    weights = models.MobileNet_V3_Small_Weights.IMAGENET1K_V1
    model = models.mobilenet_v3_small(weights=weights)

    # Freeze the whole backbone; we only train the head first.
    for param in model.parameters():
        param.requires_grad = False

    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, num_classes)

    # The new head must be trainable.
    for param in model.classifier.parameters():
        param.requires_grad = True

    return model


def unfreeze_last_block(model):
    """Stage 2: let the final feature block adapt to underwater imagery."""
    for param in model.features[-1].parameters():
        param.requires_grad = True
    return model


def collect_samples(max_per_class):
    """Gather image paths + integer labels, balanced by a per-class cap."""
    classes = sorted(
        d for d in os.listdir(DATASET_PATH)
        if os.path.isdir(os.path.join(DATASET_PATH, d))
    )
    paths, labels = [], []
    for idx, cls in enumerate(classes):
        files = (
            glob.glob(os.path.join(DATASET_PATH, cls, "*.jpg"))
            + glob.glob(os.path.join(DATASET_PATH, cls, "*.jpeg"))
            + glob.glob(os.path.join(DATASET_PATH, cls, "*.png"))
        )
        files = sorted(files)
        if max_per_class and len(files) > max_per_class:
            # Evenly spaced sample so we do not take one contiguous burst.
            step = len(files) / max_per_class
            files = [files[int(i * step)] for i in range(max_per_class)]
        paths.extend(files)
        labels.extend([idx] * len(files))
    return classes, paths, labels


def run_epoch(model, loader, criterion, optimizer=None):
    is_train = optimizer is not None
    model.train() if is_train else model.eval()

    total_loss, preds_all, labels_all = 0.0, [], []
    torch.set_grad_enabled(is_train)

    for images, labels in loader:
        if is_train:
            optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        if is_train:
            loss.backward()
            optimizer.step()

        total_loss += loss.item() * images.size(0)
        preds_all.extend(outputs.argmax(1).cpu().numpy().tolist())
        labels_all.extend(labels.numpy().tolist())

    torch.set_grad_enabled(True)
    n = len(loader.dataset)
    return total_loss / n, accuracy_score(labels_all, preds_all), preds_all, labels_all


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=6, help="Stage-1 head-training epochs")
    ap.add_argument("--stage2-epochs", type=int, default=3, help="Stage-2 fine-tune epochs")
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--max-per-class", type=int, default=400)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--stage2-lr", type=float, default=1e-4)
    ap.add_argument("--quick", action="store_true", help="Small run for smoke-testing")
    args = ap.parse_args()

    if args.quick:
        args.epochs, args.stage2_epochs, args.max_per_class = 1, 0, 40

    set_seed()
    torch.set_num_threads(os.cpu_count() or 4)

    if not os.path.isdir(DATASET_PATH):
        raise SystemExit(f"Dataset not found at {DATASET_PATH}. Run download_sea_animals.py first.")

    print("Phase 4 (v2): Transfer-learning Marine Species Classifier")
    print(f"Torch {torch.__version__} | threads={torch.get_num_threads()} | img={IMG_SIZE}x{IMG_SIZE}")

    classes, paths, labels = collect_samples(args.max_per_class)
    print(f"Classes: {len(classes)} | Images: {len(paths)} (cap {args.max_per_class}/class)")

    # ── Transforms ───────────────────────────────────────────────────────────
    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.25),
        transforms.RandomRotation(12),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    # ── Stratified split ─────────────────────────────────────────────────────
    tr_p, va_p, tr_y, va_y = train_test_split(
        paths, labels, test_size=0.2, random_state=SEED, stratify=labels
    )
    print(f"Split: {len(tr_p)} train / {len(va_p)} validation")

    train_loader = DataLoader(
        MarineDataset(tr_p, tr_y, train_tf),
        batch_size=args.batch_size, shuffle=True,
        num_workers=0, drop_last=len(tr_p) > args.batch_size,
    )
    val_loader = DataLoader(
        MarineDataset(va_p, va_y, eval_tf),
        batch_size=args.batch_size, shuffle=False, num_workers=0,
    )

    # ── Class weights (inverse frequency) ────────────────────────────────────
    counts = np.bincount(np.array(tr_y), minlength=len(classes)).astype(float)
    counts[counts == 0] = 1.0
    weights = torch.tensor(len(tr_y) / (len(classes) * counts), dtype=torch.float32)
    criterion = nn.CrossEntropyLoss(weight=weights)

    model = build_model(len(classes))

    def train_stage(tag, epochs, lr, params):
        opt = torch.optim.AdamW(params, lr=lr, weight_decay=1e-4)
        sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(epochs, 1))
        best_acc, best_state = 0.0, None
        for ep in range(1, epochs + 1):
            t0 = time.time()
            tr_loss, tr_acc, _, _ = run_epoch(model, train_loader, criterion, opt)
            va_loss, va_acc, _, _ = run_epoch(model, val_loader, criterion)
            sched.step()
            print(f"  [{tag}] epoch {ep}/{epochs} | "
                  f"train {tr_loss:.3f}/{tr_acc:.1%} | val {va_loss:.3f}/{va_acc:.1%} "
                  f"| {time.time() - t0:.0f}s")
            if va_acc > best_acc:
                best_acc = va_acc
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
        return best_acc, best_state

    # Stage 1 — train the head only
    print(f"\nStage 1: training classifier head ({args.epochs} epochs)")
    head_params = [p for p in model.parameters() if p.requires_grad]
    best_acc, best_state = train_stage("head", args.epochs, args.lr, head_params)

    # Stage 2 — unfreeze the last block for domain adaptation
    if args.stage2_epochs > 0:
        print(f"\nStage 2: fine-tuning last feature block ({args.stage2_epochs} epochs)")
        unfreeze_last_block(model)
        ft_params = [p for p in model.parameters() if p.requires_grad]
        s2_acc, s2_state = train_stage("fine-tune", args.stage2_epochs, args.stage2_lr, ft_params)
        if s2_acc > best_acc:
            best_acc, best_state = s2_acc, s2_state

    if best_state is not None:
        model.load_state_dict(best_state)

    # ── Final evaluation ─────────────────────────────────────────────────────
    print("\nFinal evaluation on held-out validation set")
    _, final_acc, preds, truths = run_epoch(model, val_loader, criterion)
    report = classification_report(
        truths, preds, labels=list(range(len(classes))),
        target_names=classes, zero_division=0, output_dict=True,
    )
    print(classification_report(
        truths, preds, labels=list(range(len(classes))),
        target_names=classes, zero_division=0,
    ))

    # ── Persist ──────────────────────────────────────────────────────────────
    torch.save(
        {
            "state_dict": model.state_dict(),
            "classes": classes,
            "arch": "mobilenet_v3_small",
            "img_size": IMG_SIZE,
            "mean": IMAGENET_MEAN,
            "std": IMAGENET_STD,
            "val_accuracy": round(float(final_acc), 4),
        },
        MODEL_OUT,
    )
    print(f"Model saved to '{MODEL_OUT}'")

    metrics = {
        "dataset": "vencerlanz09/sea-animals-image-dataste",
        "approach": "transfer-learning (mobilenet_v3_small, ImageNet pretrained)",
        "imgSize": IMG_SIZE,
        "maxImagesPerClass": args.max_per_class,
        "totalSamples": len(paths),
        "trainSamples": len(tr_p),
        "validationSamples": len(va_p),
        "classCount": len(classes),
        "classes": classes,
        "validationAccuracy": round(float(final_acc), 4),
        "macroF1": round(float(report["macro avg"]["f1-score"]), 4),
        "weightedF1": round(float(report["weighted avg"]["f1-score"]), 4),
        "perClass": {
            c: {
                "precision": round(float(report[c]["precision"]), 4),
                "recall": round(float(report[c]["recall"]), 4),
                "f1": round(float(report[c]["f1-score"]), 4),
                "support": int(report[c]["support"]),
            }
            for c in classes
        },
        "confusionMatrix": confusion_matrix(
            truths, preds, labels=list(range(len(classes)))
        ).tolist(),
        "confusionLabels": classes,
    }
    with open(METRICS_OUT, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)
    print(f"Metrics written to '{METRICS_OUT}'")
    print(f"\nValidation accuracy: {final_acc:.2%}  (previous approach: ~26.7%)")


if __name__ == "__main__":
    main()