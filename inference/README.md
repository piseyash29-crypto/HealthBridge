# Connect the bundled EfficientNet PyTorch checkpoint

The supplied trained EfficientNet-B0 `.pth` checkpoint is bundled. The service loads its actual weights using PyTorch; it does not fabricate model scores. **Preprocessing and class-index mapping remain provisional until verified with the training repository.** DenseNet121 is disabled until a compatible trained checkpoint and architecture are provided.

1. EfficientNet is preconfigured in `inference/models.json` and does not require an ONNX export.
2. The bundled model returns experimental 4-class MRI slice scores. Do not treat them as clinically validated classifications.
3. To establish prediction validity, verify the training pipeline preprocessing and exact training class-index order, then compare this service against the original notebook on the same held-out images. See `PTH-MRI-SETUP.md`.
4. DenseNet needs its own compatible PyTorch loader; adding a random `.pth` to the models directory is insufficient.
5. Install: `python -m pip install -r inference/requirements.txt`.
6. Start: `python inference/server.py` (localhost port 8001).
7. Start HealthBridge with `MRI_API_URL=http://127.0.0.1:8001`. On PowerShell: `$env:MRI_API_URL='http://127.0.0.1:8001'; node local/server.mjs`.

For the hosted app, deploy this Python service separately behind HTTPS, set `MRI_API_TOKEN` on both services and set the hosted app's `MRI_API_URL`. The hosted Worker cannot run Python/ONNX directly. Do not put API tokens in browser JavaScript. Model weights are configured server-side, not uploaded by patients.

## Scope

The service accepts de-identified PNG/JPEG 2D slices, at most 5 MB. It does not accept DICOM/NIfTI volumes and does not verify that an arbitrary uploaded photograph is an MRI. Supply only the supported MRI sequence and preprocessing used in training. There is no out-of-distribution detector or clinical calibration in this connector. Model scores must not be interpreted as a probability of disease. Additional diseases require separately trained/validated models and their own manifests; adding a disease label is not training a model.

## API

`GET /models` gives id, name, version, scope, labels, ready.
`POST /predict` takes multipart `file` and `model`; returns model, version, scope, preprocessing hash, and scores [{label, probability}]. Bearer auth is required whenever MRI_API_TOKEN is set. No image or result is saved by the inference process. HealthBridge stores the returned scores with the scan and clinician review history.

For a PyTorch export, run export from the notebook where the **trained** `model` is already loaded and in `eval()` mode. Use the exact input size and test the exported model against the notebook. For TensorFlow/Keras, export the trained model using a compatible ONNX exporter and use NHWC and its actual normalization. Attach your notebook and checkpoint for an exact adapter if the generic contract does not match.
