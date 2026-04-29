<?php
require_once dirname(__FILE__) . '/wp-load.php';

// For Elementor CONTAINERS (e-con), height is set via:
//   min_height: {unit: "px", size: 520, sizes: []}
// NOT via height:"custom" + custom_height (that's for classic Sections).

$targets = [
  1052 => 'e594ddc5',
  1053 => '465f0602',
  1051 => '1640e1bd',
];

$results = [];

function set_container_min_height(&$elements, $target_id, $height_px, &$fixed) {
  foreach ($elements as &$el) {
    if (($el['id'] ?? '') === $target_id) {
      // Remove old incorrect settings
      unset($el['settings']['height']);
      unset($el['settings']['custom_height']);
      unset($el['settings']['height_tablet']);
      unset($el['settings']['custom_height_tablet']);
      unset($el['settings']['height_mobile']);
      unset($el['settings']['custom_height_mobile']);

      // Set correct Container height settings
      $el['settings']['min_height'] = [
        'unit'  => 'px',
        'size'  => $height_px,
        'sizes' => [],
      ];
      $el['settings']['min_height_tablet'] = [
        'unit'  => 'px',
        'size'  => 360,
        'sizes' => [],
      ];
      $el['settings']['min_height_mobile'] = [
        'unit'  => 'px',
        'size'  => 260,
        'sizes' => [],
      ];
      $fixed = true;
      return;
    }
    if (!empty($el['elements'])) {
      set_container_min_height($el['elements'], $target_id, $height_px, $fixed);
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
  set_container_min_height($decoded, $container_id, 520, $fixed);

  if (!$fixed) {
    $results[] = "Page $post_id: container $container_id niet gevonden";
    continue;
  }

  update_post_meta($post_id, '_elementor_data', wp_slash(json_encode($decoded)));

  // Wipe CSS cache
  $upload_dir = wp_upload_dir();
  $css_file   = $upload_dir['basedir'] . '/elementor/css/post-' . $post_id . '.css';
  if (file_exists($css_file)) unlink($css_file);
  delete_post_meta($post_id, '_elementor_css');

  $results[] = "Page $post_id [$container_id]: min_height=520px ingesteld + CSS cache geleegd";
}

if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

@unlink(__FILE__);
echo "<pre>\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "</pre><p>Klaar.</p>";
