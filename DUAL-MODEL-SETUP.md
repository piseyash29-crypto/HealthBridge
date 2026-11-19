# HealthBridge — dual PyTorch checkpoints

Both provided `.pth` files are bundled in `inference/models/`.

- **EfficientNet-B0:** a supplied 4-output Alzheimer MRI research checkpoint. Experimental slice classification is available. Input preprocessing and exact class-index order were inferred from an incomplete notebook and still require independent verification before interpreting predictions.
- **DenseNet121:** supplied torchvision 1,000-class ImageNet weights. They are installed and can be inspected, **but they are not trained to classify Alzheimer's MRI scans**. The application intentionally keeps DenseNet prediction disabled. Train/fine-tune it with an appropriate MRI dataset, validate the preprocessing, verify the class mappings and evaluate it independently before enabling inference.

## VS Code / Windows

Extract the archive and open the **inner `HealthBridge-Updated` folder**, which contains `package.json`.

**Terminal 1:**

```powershell
python -m pip install -r inference\requirements.txt
python inference\check_models.py
python inference\server.py
```

Model status: http://127.0.0.1:8001/models . A listed checkpoint with `checkpoint_present: true` is *not* necessarily `ready: true`; only EfficientNet is currently expected to be ready.

**Terminal 2:**

```powershell
$env:MRI_API_URL="http://127.0.0.1:8001"
npm install
npm run dev
```

Open http://localhost:5173 . Sign in, open MRI workspace, upload a permitted PNG/JPEG 2D MRI slice and choose EfficientNet-B0 for experimental classification. Scoring must not be used for medical diagnosis or staging. The service does not verify that an uploaded image is actually an MRI scan.

## Login

This archive includes the SQLite login guard that avoids binding `undefined` when an account is missing. If you previously edited another extracted copy, open *this* inner folder rather than mixing files between copies.

## Data safety

Use de-identified scans and avoid entering real clinical information in a development/demo environment. Results are research classifications and require expert review; disease stage needs clinical assessment.
