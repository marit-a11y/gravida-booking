<?php
require_once dirname(__FILE__) . '/wp-load.php';

// Set explicit custom_height on the image containers in all 3 pages
// so Elementor generates the correct CSS natively

$targets = [
  1052 => 'e594ddc5',
  1053 => '465f0602',
  1051 => '1640e1bd',
];

$results = [];

function set_container_height(&$elements, $target_id, $height_px, &$fixed) {
  foreach ($elements as &$el) {
    if (($el['id'] ?? '') === $target_id) {
      $el['settings']['height'] = 'custom';
      $el['settings']['custom_height'] = [
        'unit'  => 'px',
        'size'  => $height_px,
        'sizes' => [],
      ];
      // Also set for tablet/mobile so it doesn't collapse on smaller screens
      $el['settings']['height_tablet'] = 'custom';
      $el['settings']['custom_height_tablet'] = [
        'unit'  => 'px',
        'size'  => 360,
        'sizes' => [],
      ];
      $el['settings']['height_mobile'] = 'custom';
      $el['settings']['custom_height_mobile'] = [
        'unit'  => 'px',
        'size'  => 260,
        'sizes' => [],
      ];
      $fixed = true;
      return;
    }
    if (!empty($el['elements'])) {
      set_container_height($el['elements'], $target_id, $height_px, $fixed);
    }
  }
}

foreach ($targets as $post_id => $container_id) {
  $data    = get_post_meta($post_id, '_elementor_data', true);
  $decoded = json_decode($data, true);
  if (!is_array($decoded)) {
    $results[] = "Page $post_id: JSON decode mislukt";
    continue;
  }

  $fixed = false;
  set_container_height($decoded, $container_id, 520, $fixed);

  if (!$fixed) {
    $results[] = "Page $post_id: container $container_id niet gevonden";
    continue;
  }

  update_post_meta($post_id, '_elementor_data', wp_slash(json_encode($decoded)));

  // Delete CSS cache so Elementor regenerates it
  $upload_dir = wp_upload_dir();
  $css_file = $upload_dir['basedir'] . '/elementor/css/post-' . $post_id . '.css';
  if (file_exists($css_file)) unlink($css_file);
  delete_post_meta($post_id, '_elementor_css');

  $results[] = "Page $post_id [$container_id]: hoogte ingesteld op 520px (tablet:360, mobiel:260) + CSS cache geleegd OK";
}

if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

@unlink(__FILE__);
echo "<pre>\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "</pre><p>Klaar. Herlaad met Ctrl+Shift+R.</p>";
