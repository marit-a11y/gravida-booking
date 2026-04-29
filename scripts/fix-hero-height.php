<?php
require_once dirname(__FILE__) . '/wp-load.php';

$mu_plugin_path = WP_CONTENT_DIR . '/mu-plugins/gravida-fix-timeouts.php';
$current = file_get_contents($mu_plugin_path);

// Update min-height from 380px to 520px
$updated = str_replace(
  'min-height: 380px !important;',
  'min-height: 520px !important;',
  $current
);

if ($updated === $current) {
  echo "Waarde niet gevonden — controleer het bestand.";
} else {
  file_put_contents($mu_plugin_path, $updated);
  echo "min-height bijgewerkt naar 520px.";
}

@unlink(__FILE__);
