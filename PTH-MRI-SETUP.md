# HealthBridge — PyTorch MRI integration

The supplied EfficientNet-B0 checkpoint **is bundled** under `inference/models/` (~80 MB). No ONNX conversion is required. The API returns its actual model logits converted to class scores. DenseNet121 is listed but intentionally unavailable until a separately trained, compatible `.pth` checkpoint and architecture are supplied. Do **not** rename other checkpoints to `densenet121.pth` and assume they will work.

## Windows / VS Code

Open the **inner** `HealthBridge-Updated` directory (the one containing `package.json`). Use **two terminals**:

**Terminal A — MRI model service**

```powershell
python -m pip install -r inference\requirements.txt
python inference\server.py
```

**Terminal B — HealthBridge application**

```powershell
$env:MRI_API_URL="http://127.0.0.1:8001"
npm install
npm run dev
```

Visit http://localhost:5173 . Sign in and open **MRI workspace**. Upload a PNG/JPEG axial brain MRI slice, select **EfficientNet-B0 · PyTorch**, approve analysis and click **Run analysis**. Model health: http://127.0.0.1:8001/models (should show `ready:true`).

## Research limitations — essential

* This is the user's trained model checkpoint with 4 output channels. The architecture is reconstructed to match all 383 checkpoint tensors and **strictly loads**. The actual network can run a forward pass.
* We only have the uploaded adversarial-training notebook, **not** the original `models/def_models.py` architecture implementation or the actual `prepare_dataset.ipynb` processing pipeline. Linear/BatchNorm/ReLU/Dropout blocks and resize/RGB/1/255 are **best-effort interpretations**, NOT verified replicas of training inference preprocessing. Therefore the output scores and category mapping are **experimental and not validated** until these are compared with the original training code on known test cases.
* The notebook presents the class labels in this order: `VeryMildDemented`, `NonDemented`, `ModerateDemented`, `MildDemented`. Verify this is actually the training dataset's class-to-index mapping; plotted class order alone is not conclusive.
* This model was trained on preprocessed 2D axial MRI slices (skull removed). Arbitrary MRI images / photographs / coronal or sagittal views are out of distribution. The code cannot establish that the uploaded image is a brain MRI.
* **Predicted classes are NOT Alzheimer's stages or clinical diagnoses.** Scores are uncalibrated model probabilities, not personal disease probabilities. A clinician must assess the full scan and clinical context.
* Never upload personally identifying medical images to services you do not control. This local MRI service does not store uploaded images, but the HealthBridge application stores scan records.

## Troubleshooting

* `No trained model connected` — confirm Terminal A is running and Terminal B has `MRI_API_URL` set before `npm run dev`.
* Model unavailable — visit `/models` on port 8001 and confirm ready is true; verify PyTorch dependencies installed.
* `Invalid image` — use an actual PNG/JPEG slice under 5 MB.
* For more accurate inference, replace the provisional architecture/preprocessing with the original model author implementation and rerun validation before interpreting any result.
