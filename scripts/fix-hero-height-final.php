<?php
require_once dirname(__FILE__) . '/wp-load.php';

// Correct image container IDs (verified from live CSS):
//   1052 digitale  → e594ddc5
//   1053 gedrukte  → a693f1b2  (was incorrectly set to 465f0602)
//   1051 usb       → a60c12af  (was incorrectly set to 1640e1bd)
// Also: undo incorrect min_height on 465f0602 and 1640e1bd

$targets = [
  1052 => ['correct' => 'e594ddc5', 'wrong' => null],
  1053 => ['correct' => 'a693f1b2', 'wrong' => '465f0602'],
  1051 => ['correct' => 'a60c12af', 'wrong' => '1640e1bd'],
];

function update_height(&$elements, $target_id, $height_px, $remove, &$fixed) {
  foreach ($elements as &$el) {
    if (($el['id'] ?? '') === $target_id) {
      if ($remove) {
        // Undo incorrect settings
        unset($el['settings']['min_height']);
        unset($el['settings']['min_height_tablet']);
        unset($el['settings']['min_height_mobile']);
        unset($el['settings']['height']);
        unset($el['settings']['custom_height']);
        unset($el['settings']['height_tablet']);
        unset($el['settings']['custom_height_tablet']);
        unset($el['settings']['height_mobile']);
        unset($el['settings']['custom_height_mobile']);
      } else {
        $el['settings']['min_height'] = ['unit' => 'px', 'size' => $height_px, 'sizes' => []];
        $el['settings']['min_height_tablet'] = ['unit' => 'px', 'size' => 360, 'sizes' => []];
        $el['settings']['min_height_mobile'] = ['unit' => 'px', 'size' => 260, 'sizes' => []];
      }
      $fixed = true;
      return;
    }
    if (!empty($el['elements'])) {
      update_height($el['elements'], $target_id, $height_px, $remove, $fixed);
    }
  }
}

$results = [];

foreach ($targets as $post_id => $ids) {
  $data    = get_post_meta($post_id, '_elementor_data', true);
  $decoded = json_decode($data, true);

  // 1. Set min_height on correct container
  $fixed = false;
  update_height($decoded, $ids['correct'], 520, false, $fixed);
  $results[] = "Page $post_id [{$ids['correct']}]: min_height=520px " . ($fixed ? 'OK' : 'NIET GEVONDEN');

  // 2. Remove incorrect min_height from wrong container (if applicable)
  if ($ids['wrong']) {
    $fixed2 = false;
    update_height($decoded, $ids['wrong'], 0, true, $fixed2);
    $results[] = "Page $post_id [{$ids['wrong']}]: incorrecte hoogte verwijderd " . ($fixed2 ? 'OK' : 'niet aanwezig');
  }

  update_post_meta($post_id, '_elementor_data', wp_slash(json_encode($decoded)));

  // Delete CSS cache
  $upload_dir = wp_upload_dir();
  $css_file = $upload_dir['basedir'] . '/elementor/css/post-' . $post_id . '.css';
  if (file_exists($css_file)) unlink($css_file);
  delete_post_meta($post_id, '_elementor_css');
}

if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

// Also update mu-plugin CSS to use correct IDs
$mu_path = WP_CONTENT_DIR . '/mu-plugins/gravida-fix-timeouts.php';
$mu = file_get_contents($mu_path);
$mu = str_replace(
  '.elementor-element-465f0602,
.elementor-element-1640e1bd {',
  '.elementor-element-a693f1b2,
.elementor-element-a60c12af {',
  $mu
);
file_put_contents($mu_path, $mu);
$results[] = "mu-plugin CSS bijgewerkt met juiste IDs";

@unlink(__FILE__);
echo "<pre>\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "</pre><p>Klaar.</p>";
