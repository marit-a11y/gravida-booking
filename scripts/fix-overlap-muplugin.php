<?php
require_once dirname(__FILE__) . '/wp-load.php';

$mu_plugin_path = WP_CONTENT_DIR . '/mu-plugins/gravida-fix-timeouts.php';
$current = file_get_contents($mu_plugin_path);

if (strpos($current, 'cadeau-iframe-overlap-fix') !== false) {
  echo "Fix al aanwezig — verwijder eerst de oude versie.";
  @unlink(__FILE__);
  exit;
}

// Hero image container IDs per page:
//   1052 digitale-cadeaubon  → e594ddc5
//   1053 gedrukte-cadeaubon  → 465f0602
//   1051 usb-cadeaubox       → 1640e1bd
//
// Iframe section IDs:
//   1052 → 4ebee70a
//   1053 → d717107c
//   1051 → 4b5d62b0

$css_block = "
// Fix iframe overlap on cadeau subpages — cadeau-iframe-overlap-fix
add_action('wp_head', function() {
  \$cadeau_slugs = ['digitale-cadeaubon', 'gedrukte-cadeaubon', 'usb-cadeaubox'];
  \$slug = get_post_field('post_name', get_queried_object_id());
  if (!in_array(\$slug, \$cadeau_slugs)) return;
  echo '<style>
/* Hero image containers: ensure min-height so background image shows */
.elementor-element-e594ddc5,
.elementor-element-465f0602,
.elementor-element-1640e1bd {
  min-height: 380px !important;
  overflow: hidden !important;
}
/* Remove any negative top margin from iframe sections */
.elementor-element-4ebee70a,
.elementor-element-d717107c,
.elementor-element-4b5d62b0 {
  margin-top: 0 !important;
}
</style>';
}, 20);
";

if (substr(trim($current), -2) === '?>') {
  $current = substr(trim($current), 0, -2) . "\n" . $css_block . "\n?>";
} else {
  $current .= "\n" . $css_block;
}

file_put_contents($mu_plugin_path, $current);
echo "CSS fix toegevoegd aan mu-plugin.\n";

@unlink(__FILE__);
echo "<p>Klaar. Herlaad de pagina's (eventueel met Ctrl+Shift+R).</p>";
