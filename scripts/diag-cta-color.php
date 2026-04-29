<?php
require_once dirname(__FILE__) . '/wp-load.php';

$post_id = 1052;
$data = get_post_meta($post_id, '_elementor_data', true);
$decoded = json_decode($data, true);

// Find rkit_image_box widgets and print their full settings
function find_imageboxes($elements) {
  foreach ($elements as $el) {
    if (($el['widgetType'] ?? '') === 'rkit_image_box') {
      $s = $el['settings'] ?? [];
      echo "<pre>[" . $el['id'] . "] rkit_image_box\n";
      // Print color-related settings
      foreach ($s as $k => $v) {
        if (is_string($v) && (stripos($k,'color') !== false || stripos($k,'btn') !== false || stripos($k,'button') !== false || stripos($k,'bg') !== false || stripos($k,'background') !== false)) {
          echo "  $k => $v\n";
        }
      }
      echo "</pre>";
    }
    if (!empty($el['elements'])) find_imageboxes($el['elements']);
  }
}

find_imageboxes($decoded);
@unlink(__FILE__);
