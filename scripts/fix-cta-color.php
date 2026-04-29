<?php
require_once dirname(__FILE__) . '/wp-load.php';

$mu_plugin_path = WP_CONTENT_DIR . '/mu-plugins/gravida-fix-timeouts.php';
$current = file_get_contents($mu_plugin_path);

// Replace the existing overlap CSS block with an expanded version
// that also fixes button colors on all 3 cadeau pages

$old_css = "echo '<style>
/* Hero image containers: ensure min-height so background image shows */
.elementor-element-e594ddc5,
.elementor-element-465f0602,
.elementor-element-1640e1bd {
  min-height: 520px !important;
  overflow: hidden !important;
}
/* Remove any negative top margin from iframe sections */
.elementor-element-4ebee70a,
.elementor-element-d717107c,
.elementor-element-4b5d62b0 {
  margin-top: 0 !important;
}
</style>';";

$new_css = "echo '<style>
/* Hero image containers: ensure min-height so background image shows */
.elementor-element-e594ddc5,
.elementor-element-465f0602,
.elementor-element-1640e1bd {
  min-height: 520px !important;
  overflow: hidden !important;
}
/* Remove any negative top margin from iframe sections */
.elementor-element-4ebee70a,
.elementor-element-d717107c,
.elementor-element-4b5d62b0 {
  margin-top: 0 !important;
}
/* CTA buttons: Gravida huisstijl (vervangt standaard turquoise) */
.rkit-readmore-imagebox-btn {
  background-color: #3d5c41 !important;
  color: #ffffff !important;
  border-color: #3d5c41 !important;
  border-radius: 6px !important;
  padding: 10px 22px !important;
  font-family: \"Inter Tight\", sans-serif !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  text-decoration: none !important;
  transition: background-color 0.15s ease !important;
}
.rkit-readmore-imagebox-btn:hover {
  background-color: #2d4430 !important;
  color: #ffffff !important;
}
.rkit-readmore-imagebox-btn i {
  display: none !important;
}
</style>';";

if (strpos($current, $old_css) !== false) {
  $updated = str_replace($old_css, $new_css, $current);
  file_put_contents($mu_plugin_path, $updated);
  echo "CTA kleuren en stijl bijgewerkt in mu-plugin.";
} else {
  echo "Originele CSS-blok niet exact gevonden. Voeg handmatig toe of check het bestand.\n";
  // Fallback: just append new CSS hook
  $fallback = "
// CTA button color fix — cadeau pages
add_action('wp_head', function() {
  \$cadeau_slugs = ['digitale-cadeaubon', 'gedrukte-cadeaubon', 'usb-cadeaubox'];
  \$slug = get_post_field('post_name', get_queried_object_id());
  if (!in_array(\$slug, \$cadeau_slugs)) return;
  echo '<style>
.rkit-readmore-imagebox-btn {
  background-color: #3d5c41 !important;
  color: #ffffff !important;
  border-color: #3d5c41 !important;
  border-radius: 6px !important;
  padding: 10px 22px !important;
  font-family: \"Inter Tight\", sans-serif !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  text-decoration: none !important;
  transition: background-color 0.15s ease !important;
}
.rkit-readmore-imagebox-btn:hover {
  background-color: #2d4430 !important;
  color: #ffffff !important;
}
.rkit-readmore-imagebox-btn i { display: none !important; }
</style>';
}, 25);
";
  if (substr(trim($current), -2) === '?>') {
    $current = substr(trim($current), 0, -2) . $fallback . "\n?>";
  } else {
    $current .= $fallback;
  }
  file_put_contents($mu_plugin_path, $current);
  echo "Fallback: aparte CSS hook toegevoegd.";
}

@unlink(__FILE__);
echo "\n<p>Klaar.</p>";
