<?php
require_once dirname(__FILE__) . '/wp-load.php';

$mu_plugin_path = WP_CONTENT_DIR . '/mu-plugins/gravida-fix-timeouts.php';
$current = file_get_contents($mu_plugin_path);

// Replace the broken hero image CSS with the correct version
// Problem: overflow:hidden was cutting the background image
// Fix: use Elementor's CSS variable --min-height, no overflow:hidden

$old = '/* Hero image containers: ensure min-height so background image shows */
.elementor-element-e594ddc5,
.elementor-element-465f0602,
.elementor-element-1640e1bd {
  min-height: 520px !important;
  overflow: hidden !important;
}';

$new = '/* Hero image containers: set height via Elementor CSS variable + direct property */
.elementor-element-e594ddc5,
.elementor-element-465f0602,
.elementor-element-1640e1bd {
  --min-height: 520px !important;
  min-height: 520px !important;
}';

if (strpos($current, $old) !== false) {
  $updated = str_replace($old, $new, $current);
  file_put_contents($mu_plugin_path, $updated);
  echo "Hero CSS gecorrigeerd (overflow:hidden verwijderd, --min-height toegevoegd).";
} else {
  echo "Originele CSS-blok niet exact gevonden:\n";
  // Show what we have now for debug
  preg_match('/Hero image containers.*?(?=\/\* Remove)/s', $current, $m);
  echo htmlspecialchars($m[0] ?? 'niet gevonden');
}

@unlink(__FILE__);
echo "\n<p>Klaar.</p>";
