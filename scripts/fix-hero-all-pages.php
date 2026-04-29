<?php
require_once dirname(__FILE__) . '/wp-load.php';

// Apply the same hero section padding fix to pages 1053 and 1051
// (1052 was already done earlier)
// Also delete their CSS cache so changes are picked up immediately.

$pages = [1053, 1051];
$results = [];

function contains_iframe_element($el) {
  if (($el['widgetType'] ?? '') === 'html') {
    return strpos($el['settings']['html'] ?? '', 'gravida-booking') !== false;
  }
  foreach ($el['elements'] ?? [] as $child) {
    if (contains_iframe_element($child)) return true;
  }
  return false;
}

foreach ($pages as $post_id) {
  $data    = get_post_meta($post_id, '_elementor_data', true);
  $decoded = json_decode($data, true);
  if (!is_array($decoded)) {
    $results[] = "Page $post_id: JSON decode mislukt";
    continue;
  }

  // Find the index of the iframe section
  $iframe_idx = null;
  foreach ($decoded as $i => $el) {
    if (contains_iframe_element($el)) {
      $iframe_idx = $i;
      break;
    }
  }

  if ($iframe_idx === null || $iframe_idx === 0) {
    $results[] = "Page $post_id: iframe sectie niet gevonden";
    continue;
  }

  // Hero section = section just before the iframe section
  $hero_idx = $iframe_idx - 1;
  $decoded[$hero_idx]['settings']['padding'] = [
    'top'    => '60',
    'right'  => '0',
    'bottom' => '60',
    'left'   => '0',
    'unit'   => 'px',
    'isLinked' => false,
  ];

  update_post_meta($post_id, '_elementor_data', wp_slash(json_encode($decoded)));

  // Delete page CSS cache
  $upload_dir = wp_upload_dir();
  $css_file = $upload_dir['basedir'] . '/elementor/css/post-' . $post_id . '.css';
  if (file_exists($css_file)) {
    unlink($css_file);
    $results[] = "Page $post_id: padding + CSS cache verwijderd OK";
  } else {
    $results[] = "Page $post_id: padding bijgewerkt (geen CSS cache gevonden)";
  }

  delete_post_meta($post_id, '_elementor_css');
}

if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

@unlink(__FILE__);
echo "<pre>\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "</pre><p>Klaar.</p>";
