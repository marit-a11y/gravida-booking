<?php
require_once dirname(__FILE__) . '/wp-load.php';

// 1. Delete Elementor CSS cache files for the 3 pages
$post_ids = [1052, 1053, 1051];
$upload_dir = wp_upload_dir();
$css_dir = $upload_dir['basedir'] . '/elementor/css/';

foreach ($post_ids as $pid) {
  $file = $css_dir . 'post-' . $pid . '.css';
  if (file_exists($file)) {
    unlink($file);
    echo "CSS cache verwijderd: $file\n";
  } else {
    echo "Geen cache gevonden: $file\n";
  }
}

// 2. Clear Elementor file manager cache
if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
  echo "Elementor file cache geleegd\n";
}

// 3. Add CSS via mu-plugin to fix the overlap on all 3 cadeau pages
$mu_plugin_path = WP_CONTENT_DIR . '/mu-plugins/gravida-fix-timeouts.php';
$current = file_get_contents($mu_plugin_path);

$new_css_block = "
// Fix iframe overlap on cadeau subpages
add_action('wp_head', function() {
  \$cadeau_pages = ['digitale-cadeaubon', 'gedrukte-cadeaubon', 'usb-cadeaubox'];
  \$slug = get_post_field('post_name', get_queried_object_id());
  if (!in_array(\$slug, \$cadeau_pages)) return;
  echo '<style>
/* Fix: prevent hero image from overlapping the booking form section */
.e-con.e-parent:has(iframe[src*=\"gravida-booking\"]) {
  margin-top: 0 !important;
  position: relative !important;
  z-index: 1 !important;
}
/* Ensure hero section does not overflow */
.e-con.e-parent:not(:last-child):has(.elementor-widget-html ~ *),
body .elementor-section:first-of-type {
  overflow: hidden !important;
}
</style>';
});
";

// Only add if not already present
if (strpos($current, 'Fix iframe overlap') === false) {
  // Insert before the last closing ?> or at the end
  if (substr(trim($current), -2) === '?>') {
    $current = substr(trim($current), 0, -2) . "\n" . $new_css_block . "\n?>";
  } else {
    $current .= "\n" . $new_css_block;
  }
  file_put_contents($mu_plugin_path, $current);
  echo "CSS fix toegevoegd aan mu-plugin\n";
} else {
  echo "CSS fix al aanwezig in mu-plugin\n";
}

// 4. Also directly fix via post meta: clear the cached CSS
foreach ($post_ids as $pid) {
  delete_post_meta($pid, '_elementor_css');
}
echo "Post meta CSS cache geleegd\n";

@unlink(__FILE__);
echo "<p>Klaar. Herlaad de cadeau-pagina's nu.</p>";
