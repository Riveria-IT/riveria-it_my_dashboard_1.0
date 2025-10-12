<?php
// Speicherort für JSON-Dateien
$DATA_DIR = __DIR__ . '/data';

// Optional: CORS-Whitelist (gleiche Origin ist Standard)
$ALLOWED_ORIGINS = []; // z.B. ['https://example.com']

if (!is_dir($DATA_DIR)) {
  @mkdir($DATA_DIR, 0775, true);
}
